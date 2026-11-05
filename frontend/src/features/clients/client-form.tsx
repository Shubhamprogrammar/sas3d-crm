"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Drawer, FormField, Input, Select, Textarea } from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useTeamOptions } from "@/features/shared/options";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { CLIENT_STATUSES, CLIENT_TYPES, COMMON_TIMEZONES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Client } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  companyName: z.string(),
  type: z.enum(CLIENT_TYPES),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  phone: z.string(),
  website: z.string(),
  country: z.string(),
  city: z.string(),
  timezone: z.string(),
  status: z.enum(CLIENT_STATUSES),
  relationshipManager: z.string(),
  notes: z.string(),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
  tax: z.object({ idType: z.string(), idNumber: z.string() }),
});
type Values = z.infer<typeof schema>;

const toValues = (client: Client | null | undefined, me: string): Values => ({
  name: client?.name ?? "",
  companyName: client?.companyName ?? "",
  type: (client?.type ?? "SMALL_BUSINESS") as Values["type"],
  email: client?.email ?? "",
  phone: client?.phone ?? "",
  website: client?.website ?? "",
  country: client?.country ?? "",
  city: client?.city ?? "",
  timezone: client?.timezone ?? "",
  status: (client?.status ?? "ACTIVE") as Values["status"],
  relationshipManager: client ? (client.relationshipManager?._id ?? "") : me,
  notes: client?.notes ?? "",
  billingAddress: {
    line1: client?.billingAddress?.line1 ?? "",
    line2: client?.billingAddress?.line2 ?? "",
    city: client?.billingAddress?.city ?? "",
    state: client?.billingAddress?.state ?? "",
    postalCode: client?.billingAddress?.postalCode ?? "",
    country: client?.billingAddress?.country ?? "",
  },
  tax: { idType: client?.tax?.idType ?? "", idNumber: client?.tax?.idNumber ?? "" },
});

export function ClientForm({
  open,
  onClose,
  client,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  onCreated?: (id: string) => void;
}) {
  const { me } = useMe();
  const team = useTeamOptions();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset(toValues(client, me?.user._id ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  const save = useApiMutation<Values, { _id: string }>({
    request: (values) =>
      client ? api.patch(`/clients/${client._id}`, values) : api.post("/clients", values),
    invalidate: ["/clients", "/dashboard"],
    onSuccess: (created) => {
      onClose();
      if (!client) onCreated?.(created._id);
    },
    onError: (error) => applyServerErrors(error, setError),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={client ? "Edit client" : "New client"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="client-form" loading={save.isPending}>
            {client ? "Save changes" : "Create client"}
          </Button>
        </>
      }
    >
      <form
        id="client-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Client name" required error={errors.name?.message}>
            {(f) => <Input {...f} {...register("name")} />}
          </FormField>
          <FormField label="Company">
            {(f) => <Input {...f} {...register("companyName")} />}
          </FormField>
          <FormField label="Type">
            {(f) => <Select {...f} {...register("type")} options={toOptions(CLIENT_TYPES)} />}
          </FormField>
          <FormField label="Status">
            {(f) => <Select {...f} {...register("status")} options={toOptions(CLIENT_STATUSES)} />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(f) => <Input type="email" {...f} {...register("email")} />}
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            {(f) => <Input type="tel" {...f} {...register("phone")} />}
          </FormField>
          <FormField label="Website" error={errors.website?.message}>
            {(f) => <Input type="url" placeholder="https://" {...f} {...register("website")} />}
          </FormField>
          <FormField label="Timezone">
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
          <FormField label="City">{(f) => <Input {...f} {...register("city")} />}</FormField>
          {team.length > 0 && (
            <FormField label="Relationship manager" className="sm:col-span-2">
              {(f) => (
                <Select
                  {...f}
                  {...register("relationshipManager")}
                  options={team}
                  placeholder="None"
                />
              )}
            </FormField>
          )}
        </div>
        <fieldset className="space-y-3">
          <legend className="font-medium">Billing address</legend>
          <FormField label="Address line 1">
            {(f) => <Input {...f} {...register("billingAddress.line1")} />}
          </FormField>
          <FormField label="Address line 2">
            {(f) => <Input {...f} {...register("billingAddress.line2")} />}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="City">
              {(f) => <Input {...f} {...register("billingAddress.city")} />}
            </FormField>
            <FormField label="State or region">
              {(f) => <Input {...f} {...register("billingAddress.state")} />}
            </FormField>
            <FormField label="Postal code">
              {(f) => <Input {...f} {...register("billingAddress.postalCode")} />}
            </FormField>
            <FormField label="Country">
              {(f) => <Input {...f} {...register("billingAddress.country")} />}
            </FormField>
          </div>
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-medium">Tax identification</legend>
          <FormField label="Type" hint="GSTIN, VAT, EIN, TRN...">
            {(f) => <Input {...f} {...register("tax.idType")} />}
          </FormField>
          <FormField label="Number">
            {(f) => <Input {...f} {...register("tax.idNumber")} />}
          </FormField>
        </fieldset>
        <FormField label="Notes">{(f) => <Textarea {...f} {...register("notes")} />}</FormField>
      </form>
    </Drawer>
  );
}
