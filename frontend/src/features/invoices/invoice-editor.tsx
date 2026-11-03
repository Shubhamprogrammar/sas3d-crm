"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { z } from "zod";
import { Button, Card, DatePicker, FormField, PageHeader, Select, Textarea } from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import {
  emptyLine,
  linesToValues,
  LineItemsEditor,
  pricingPayload,
} from "@/features/shared/line-items-editor";
import { useClientOptions, useProjectOptions } from "@/features/shared/options";
import { pricingFields } from "@/features/shared/pricing-schema";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { CURRENCIES } from "@/lib/constants";
import { api } from "@/services/api";
import type { Invoice } from "@/types";
import { dayInput, todayInput } from "@/utils/format";
import { bpToPercent, fromMinor } from "@/utils/money";

const schema = z
  .object({
    ...pricingFields,
    client: z.string().min(1, "Choose a client"),
    project: z.string(),
    issueDate: z.string().min(1, "Required"),
    dueDate: z.string().min(1, "Required"),
    paymentTerms: z.string(),
    notes: z.string(),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: "Cannot be before the issue date",
    path: ["dueDate"],
  });
type Values = z.infer<typeof schema>;

export function InvoiceEditor({
  invoice,
  defaults = {},
}: {
  invoice?: Invoice;
  defaults?: { client?: string; project?: string };
}) {
  const router = useRouter();
  const { preferences } = useMe();
  const clients = useClientOptions();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: invoice
      ? {
          client: invoice.client._id,
          project: invoice.project?._id ?? "",
          issueDate: dayInput(invoice.issueDate),
          dueDate: dayInput(invoice.dueDate),
          currency: invoice.currency as Values["currency"],
          items: linesToValues(invoice.items),
          discountType: invoice.discount?.type ?? "PERCENT",
          discountValue:
            invoice.discount?.type === "FIXED"
              ? fromMinor(invoice.discount.value)
              : bpToPercent(invoice.discount?.value),
          taxRate: bpToPercent(invoice.taxRateBp),
          taxLabel: invoice.taxLabel,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
        }
      : {
          client: defaults.client ?? "",
          project: defaults.project ?? "",
          issueDate: todayInput(),
          dueDate: todayInput(),
          currency: preferences.defaultCurrency as Values["currency"],
          items: [emptyLine],
          discountType: "PERCENT",
          discountValue: "",
          taxRate: "",
          taxLabel: "Tax",
          paymentTerms: "",
          notes: "",
        },
  });
  const selectedClient = useWatch({ control, name: "client" });
  const projects = useProjectOptions(selectedClient || undefined);

  const save = useApiMutation<Values, { _id: string }>({
    request: (values) => {
      const body: Record<string, unknown> = {
        ...pricingPayload(values),
        client: values.client,
        project: values.project || null,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        currency: values.currency,
        notes: values.notes,
      };
      if (invoice || values.paymentTerms) body.paymentTerms = values.paymentTerms;
      return invoice ? api.patch(`/invoices/${invoice._id}`, body) : api.post("/invoices", body);
    },
    invalidate: ["/invoices", "/dashboard", "/activities", "/clients"],
    onSuccess: (saved) => router.push(`/invoices/${saved._id}`),
    onError: (error) => applyServerErrors(error, setError),
  });

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
      <PageHeader
        back={{
          href: invoice ? `/invoices/${invoice._id}` : "/invoices",
          label: invoice ? invoice.number : "Invoices",
        }}
        title={invoice ? "Edit draft invoice" : "New invoice"}
        description="Starts as a draft. It can be edited until it is issued."
        actions={
          <>
            <Button onClick={() => router.back()}>Cancel</Button>
            <Button variant="primary" type="submit" loading={save.isPending}>
              {invoice ? "Save draft" : "Create draft"}
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <Card title="Billing">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FormField label="Client" required error={errors.client?.message}>
              {(f) => (
                <Select
                  {...f}
                  {...register("client")}
                  options={clients}
                  placeholder="Choose a client"
                />
              )}
            </FormField>
            <FormField label="Project">
              {(f) => (
                <Select {...f} {...register("project")} options={projects} placeholder="None" />
              )}
            </FormField>
            <FormField label="Issue date" required error={errors.issueDate?.message}>
              {(f) => <DatePicker {...f} {...register("issueDate")} />}
            </FormField>
            <FormField label="Due date" required error={errors.dueDate?.message}>
              {(f) => <DatePicker {...f} {...register("dueDate")} />}
            </FormField>
          </div>
        </Card>
        <Card
          title="Line items"
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
            <FormField
              label="Payment terms"
              hint={invoice ? undefined : "Leave blank to use the default from Settings"}
            >
              {(f) => <Textarea {...f} {...register("paymentTerms")} />}
            </FormField>
            <FormField label="Notes" hint="Shown on the invoice">
              {(f) => <Textarea {...f} {...register("notes")} />}
            </FormField>
          </div>
        </Card>
      </div>
    </form>
  );
}
