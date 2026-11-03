"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type Control, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Card,
  DatePicker,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import {
  emptyLine,
  linesToValues,
  LineItemsEditor,
  pricingPayload,
} from "@/features/shared/line-items-editor";
import { useClientOptions } from "@/features/shared/options";
import { pricingFields } from "@/features/shared/pricing-schema";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { CURRENCIES } from "@/lib/constants";
import { api } from "@/services/api";
import type { Lead, Proposal } from "@/types";
import { dayInput, splitList } from "@/utils/format";
import { bpToPercent, fromMinor } from "@/utils/money";

const schema = z
  .object({
    ...pricingFields,
    client: z.string(),
    lead: z.string(),
    title: z.string().trim().min(1, "Project title is required"),
    description: z.string(),
    scope: z.string(),
    deliverables: z.string(),
    technologies: z.string(),
    timeline: z.string(),
    paymentTerms: z.string(),
    validUntil: z.string(),
    terms: z.string(),
    notes: z.string(),
  })
  .refine((v) => v.client || v.lead, { message: "Choose a client or a lead", path: ["client"] });
type Values = z.infer<typeof schema>;

export function ProposalEditor({
  proposal,
  defaults = {},
}: {
  proposal?: Proposal;
  defaults?: { client?: string; lead?: string };
}) {
  const router = useRouter();
  const { can, preferences } = useMe();
  const clients = useClientOptions();
  const { items: leads } = useApiList<Lead>(can("lead:read") ? "/leads" : null, {
    limit: 100,
    sortBy: "fullName",
    sortOrder: "asc",
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: proposal
      ? {
          client: proposal.client?._id ?? "",
          lead: proposal.lead?._id ?? "",
          title: proposal.title,
          description: proposal.description,
          scope: proposal.scope,
          deliverables: proposal.deliverables.join("\n"),
          technologies: proposal.technologies.join(", "),
          timeline: proposal.timeline,
          currency: proposal.currency as Values["currency"],
          items: linesToValues(proposal.items).length ? linesToValues(proposal.items) : [emptyLine],
          discountType: proposal.discount?.type ?? "PERCENT",
          discountValue:
            proposal.discount?.type === "FIXED"
              ? fromMinor(proposal.discount.value)
              : bpToPercent(proposal.discount?.value),
          taxRate: bpToPercent(proposal.taxRateBp),
          taxLabel: proposal.taxLabel,
          paymentTerms: proposal.paymentTerms,
          validUntil: dayInput(proposal.validUntil),
          terms: proposal.terms,
          notes: proposal.notes,
        }
      : {
          client: defaults.client ?? "",
          lead: defaults.lead ?? "",
          title: "",
          description: "",
          scope: "",
          deliverables: "",
          technologies: "",
          timeline: "",
          currency: preferences.defaultCurrency as Values["currency"],
          items: [emptyLine],
          discountType: "PERCENT",
          discountValue: "",
          taxRate: "",
          taxLabel: "Tax",
          paymentTerms: "",
          validUntil: "",
          terms: "",
          notes: "",
        },
  });

  const save = useApiMutation<Values, { _id: string }>({
    request: (values) => {
      const body: Record<string, unknown> = {
        ...pricingPayload(values),
        client: values.client || null,
        lead: values.lead || null,
        title: values.title,
        description: values.description,
        scope: values.scope,
        deliverables: splitList(values.deliverables),
        technologies: splitList(values.technologies),
        timeline: values.timeline,
        currency: values.currency,
        validUntil: values.validUntil || null,
        notes: values.notes,
      };
      // Blank terms on a new proposal fall back to the defaults from Settings.
      if (proposal || values.terms) body.terms = values.terms;
      if (proposal || values.paymentTerms) body.paymentTerms = values.paymentTerms;
      return proposal
        ? api.patch(`/proposals/${proposal._id}`, body)
        : api.post("/proposals", body);
    },
    invalidate: ["/proposals", "/dashboard", "/activities"],
    onSuccess: (saved) => router.push(`/proposals/${saved._id}`),
    onError: (error) => applyServerErrors(error, setError),
  });

  const leadOptions = leads.map((lead) => ({
    value: lead._id,
    label: lead.companyName ? `${lead.fullName} (${lead.companyName})` : lead.fullName,
  }));
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
      <PageHeader
        back={{
          href: proposal ? `/proposals/${proposal._id}` : "/proposals",
          label: proposal ? proposal.number : "Proposals",
        }}
        title={proposal ? "Edit proposal" : "New proposal"}
        description={
          proposal
            ? "Saving records a new revision."
            : "Line item totals are calculated by the server."
        }
        actions={
          <>
            <Button onClick={() => router.back()}>Cancel</Button>
            <Button variant="primary" type="submit" loading={save.isPending}>
              {proposal ? "Save revision" : "Create proposal"}
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <Card title="Recipient and summary">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Client" error={errors.client?.message}>
              {(f) => (
                <Select {...f} {...register("client")} options={clients} placeholder="None" />
              )}
            </FormField>
            <FormField label="Or lead">
              {(f) => (
                <Select {...f} {...register("lead")} options={leadOptions} placeholder="None" />
              )}
            </FormField>
            <FormField
              label="Project title"
              required
              className="md:col-span-2"
              error={errors.title?.message}
            >
              {(f) => <Input {...f} {...register("title")} />}
            </FormField>
            <FormField label="Description" className="md:col-span-2">
              {(f) => <Textarea {...f} {...register("description")} />}
            </FormField>
            <FormField label="Scope of work" className="md:col-span-2">
              {(f) => <Textarea rows={5} {...f} {...register("scope")} />}
            </FormField>
            <FormField label="Deliverables" hint="One per line">
              {(f) => <Textarea rows={4} {...f} {...register("deliverables")} />}
            </FormField>
            <div className="space-y-3">
              <FormField label="Technologies" hint="Separated by commas">
                {(f) => <Input {...f} {...register("technologies")} />}
              </FormField>
              <FormField label="Timeline">
                {(f) => (
                  <Input {...f} {...register("timeline")} placeholder="e.g. 8 weeks from kickoff" />
                )}
              </FormField>
            </div>
          </div>
        </Card>
        <Card
          title="Pricing"
          action={
            <div className="w-28">
              <Select
                aria-label="Currency"
                {...register("currency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          }
        >
          <LineItemsEditor
            control={control as unknown as Control<never>}
            register={register as unknown as UseFormRegister<never>}
            setValue={setValue as unknown as UseFormSetValue<never>}
            errors={errors}
          />
        </Card>
        <Card title="Terms">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Valid until">
              {(f) => <DatePicker {...f} {...register("validUntil")} />}
            </FormField>
            <div className="hidden md:block" />
            <FormField
              label="Payment terms"
              hint={proposal ? undefined : "Leave blank to use the default from Settings"}
            >
              {(f) => <Textarea {...f} {...register("paymentTerms")} />}
            </FormField>
            <FormField
              label="Terms and conditions"
              hint={proposal ? undefined : "Leave blank to use the default from Settings"}
            >
              {(f) => <Textarea {...f} {...register("terms")} />}
            </FormField>
            <FormField label="Internal notes" hint="Not shown on the PDF" className="md:col-span-2">
              {(f) => <Textarea {...f} {...register("notes")} />}
            </FormField>
          </div>
        </Card>
      </div>
    </form>
  );
}
