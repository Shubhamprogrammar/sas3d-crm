"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, DatePicker, Drawer, FormField, Input, Select, Textarea } from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useServiceOptions, useTeamOptions } from "@/features/shared/options";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { COMMON_TIMEZONES, CURRENCIES, LEAD_SOURCES, PRIORITIES, toOptions } from "@/lib/constants";
import { api, type FieldError } from "@/services/api";
import type { Lead } from "@/types";
import { localInput, localToIso } from "@/utils/format";
import { fromMinor, isValidAmount, toMinor } from "@/utils/money";

const schema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  companyName: z.string(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  phone: z.string(),
  whatsapp: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  timezone: z.string(),
  website: z.string(),
  linkedinUrl: z.string(),
  source: z.enum(LEAD_SOURCES),
  interestedServices: z.array(z.string()),
  estimatedBudget: z.string().refine(isValidAmount, "Enter an amount like 1500.00"),
  budgetCurrency: z.enum(CURRENCIES),
  priority: z.enum(PRIORITIES),
  assignedTo: z.string(),
  description: z.string(),
  requirements: z.string(),
  internalNotes: z.string(),
  nextFollowUpAt: z.string(),
});
type Values = z.infer<typeof schema>;

const toValues = (
  lead: Lead | null | undefined,
  defaults: { assignedTo: string; currency: string },
): Values => ({
  fullName: lead?.fullName ?? "",
  companyName: lead?.companyName ?? "",
  email: lead?.email ?? "",
  phone: lead?.phone ?? "",
  whatsapp: lead?.whatsapp ?? "",
  country: lead?.country ?? "",
  state: lead?.state ?? "",
  city: lead?.city ?? "",
  timezone: lead?.timezone ?? "",
  website: lead?.website ?? "",
  linkedinUrl: lead?.linkedinUrl ?? "",
  source: (lead?.source ?? "WEBSITE") as Values["source"],
  interestedServices: lead?.interestedServices.map((s) => s._id) ?? [],
  estimatedBudget: lead ? fromMinor(lead.estimatedBudget) : "",
  budgetCurrency: (lead?.budgetCurrency ?? defaults.currency) as Values["budgetCurrency"],
  priority: (lead?.priority ?? "MEDIUM") as Values["priority"],
  assignedTo: lead ? (lead.assignedTo?._id ?? "") : defaults.assignedTo,
  description: lead?.description ?? "",
  requirements: lead?.requirements ?? "",
  internalNotes: lead?.internalNotes ?? "",
  nextFollowUpAt: localInput(lead?.nextFollowUpAt),
});

const toPayload = (values: Values) => ({
  ...values,
  estimatedBudget: toMinor(values.estimatedBudget),
  nextFollowUpAt: localToIso(values.nextFollowUpAt),
});

export function LeadForm({
  open,
  onClose,
  lead,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  onCreated?: (id: string) => void;
}) {
  const { me, preferences } = useMe();
  const team = useTeamOptions();
  const { options: services } = useServiceOptions();
  const [duplicates, setDuplicates] = useState<FieldError[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        toValues(lead, { assignedTo: me?.user._id ?? "", currency: preferences.defaultCurrency }),
      );

      setDuplicates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead]);

  const save = useApiMutation<{ values: Values; allowDuplicate?: boolean }, { _id: string }>({
    request: ({ values, allowDuplicate }) =>
      lead
        ? api.patch(`/leads/${lead._id}`, toPayload(values))
        : api.post("/leads", { ...toPayload(values), allowDuplicate }),
    invalidate: ["/leads", "/opportunities", "/dashboard"],
    toastError: false,
    onSuccess: (created) => {
      onClose();
      if (!lead) onCreated?.(created._id);
    },
    onError: (error) => {
      if (error.status === 409 && error.errors[0]?.code === "DUPLICATE_LEAD")
        setDuplicates(error.errors);
      else {
        applyServerErrors(error, setError);
        setError("root", { message: error.message });
      }
    },
  });
  const submit = handleSubmit((values) => save.mutate({ values }));
  const forceCreate = handleSubmit((values) => save.mutate({ values, allowDuplicate: true }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={lead ? "Edit lead" : "New lead"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {duplicates.length > 0 ? (
            <Button variant="danger" loading={save.isPending} onClick={forceCreate}>
              Create anyway
            </Button>
          ) : (
            <Button variant="primary" type="submit" form="lead-form" loading={save.isPending}>
              {lead ? "Save changes" : "Create lead"}
            </Button>
          )}
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="space-y-3" noValidate>
        {errors.root?.message && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {errors.root.message}
          </p>
        )}
        {duplicates.length > 0 && (
          <div role="alert" className="rounded-lg bg-warn-soft p-3 text-[13px] text-warn">
            <p className="flex items-center gap-1.5 font-semibold">
              <TriangleAlert className="size-4" aria-hidden />
              Possible duplicate
            </p>
            <p className="mb-1">A lead with this email or phone already exists:</p>
            <ul className="list-disc pl-5">
              {duplicates.map((d) => (
                <li key={String(d.id)}>
                  {String(d.fullName)}
                  {d.companyName ? ` (${String(d.companyName)})` : ""}, {String(d.email || d.phone)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.fullName?.message}>
            {(f) => <Input {...f} {...register("fullName")} />}
          </FormField>
          <FormField label="Company">
            {(f) => <Input {...f} {...register("companyName")} />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(f) => (
              <Input
                type="email"
                {...f}
                {...register("email", { onChange: () => setDuplicates([]) })}
              />
            )}
          </FormField>
          <FormField
            label="Phone"
            hint="With country code, e.g. +1 415 555 0100"
            error={errors.phone?.message}
          >
            {(f) => (
              <Input
                type="tel"
                {...f}
                {...register("phone", { onChange: () => setDuplicates([]) })}
              />
            )}
          </FormField>
          <FormField label="WhatsApp" error={errors.whatsapp?.message}>
            {(f) => <Input type="tel" {...f} {...register("whatsapp")} />}
          </FormField>
          <FormField label="Timezone" error={errors.timezone?.message}>
            {(f) => (
              <Select
                {...f}
                {...register("timezone")}
                options={COMMON_TIMEZONES.map((z) => ({ value: z, label: z }))}
                placeholder="Not set"
              />
            )}
          </FormField>
          <FormField label="Country">{(f) => <Input {...f} {...register("country")} />}</FormField>
          <FormField label="State or region">
            {(f) => <Input {...f} {...register("state")} />}
          </FormField>
          <FormField label="City">{(f) => <Input {...f} {...register("city")} />}</FormField>
          <FormField label="Website" error={errors.website?.message}>
            {(f) => <Input type="url" placeholder="https://" {...f} {...register("website")} />}
          </FormField>
          <FormField label="LinkedIn URL" error={errors.linkedinUrl?.message}>
            {(f) => <Input type="url" placeholder="https://" {...f} {...register("linkedinUrl")} />}
          </FormField>
          <FormField label="Source">
            {(f) => <Select {...f} {...register("source")} options={toOptions(LEAD_SOURCES)} />}
          </FormField>
          <FormField label="Estimated budget" error={errors.estimatedBudget?.message}>
            {(f) => (
              <Input
                inputMode="decimal"
                placeholder="0.00"
                {...f}
                {...register("estimatedBudget")}
              />
            )}
          </FormField>
          <FormField label="Budget currency">
            {(f) => (
              <Select
                {...f}
                {...register("budgetCurrency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            )}
          </FormField>
          <FormField label="Priority">
            {(f) => <Select {...f} {...register("priority")} options={toOptions(PRIORITIES)} />}
          </FormField>
          {team.length > 0 && (
            <FormField label="Assigned to">
              {(f) => (
                <Select
                  {...f}
                  {...register("assignedTo")}
                  options={team}
                  placeholder="Unassigned"
                />
              )}
            </FormField>
          )}
          <FormField label="Next follow-up" className="sm:col-span-2">
            {(f) => <DatePicker withTime {...f} {...register("nextFollowUpAt")} />}
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium text-ink-2">Interested services</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {services.map((service) => (
              <label key={service.value} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  value={service.value}
                  className="size-4 accent-[var(--accent)]"
                  {...register("interestedServices")}
                />
                {service.label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Description">
          {(f) => <Textarea {...f} {...register("description")} />}
        </FormField>
        <FormField label="Requirements">
          {(f) => <Textarea {...f} {...register("requirements")} />}
        </FormField>
        <FormField label="Internal notes">
          {(f) => <Textarea {...f} {...register("internalNotes")} />}
        </FormField>
      </form>
    </Drawer>
  );
}
