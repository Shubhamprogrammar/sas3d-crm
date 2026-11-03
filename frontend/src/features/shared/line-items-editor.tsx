"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { Button, FormField, Input, Select } from "@/components/ui";
import { useApiMutation } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/services/api";
import type { LineItem, Service, Totals } from "@/types";
import { formatMoney, fromMinor, isValidAmount, percentToBp, toMinor } from "@/utils/money";
import { useServiceOptions } from "./options";

export interface LineItemValues {
  service: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface PricingValues {
  items: LineItemValues[];
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  taxRate: string;
  taxLabel: string;
  currency: string;
}

export const emptyLine: LineItemValues = {
  service: "",
  description: "",
  quantity: "1",
  unitPrice: "",
};

export const linesToValues = (items: LineItem[]): LineItemValues[] =>
  items.map((item) => ({
    service: typeof item.service === "object" ? (item.service?._id ?? "") : (item.service ?? ""),
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: fromMinor(item.unitPrice),
  }));

export const isQuantityValid = (value: string) =>
  /^\d+(\.\d{1,3})?$/.test(value.trim()) && Number(value) > 0;
export const isPriceValid = (value: string) => isValidAmount(value) && value.trim() !== "";

/** Converts form text to the integer API payload shared by proposals and invoices. */
export function pricingPayload(values: PricingValues) {
  const discountValue = values.discountValue.trim();
  return {
    items: values.items.map((item) => ({
      service: item.service || null,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: toMinor(item.unitPrice),
    })),
    discount: {
      type: values.discountType,
      value:
        values.discountType === "PERCENT" ? percentToBp(discountValue) : toMinor(discountValue),
    },
    taxRateBp: percentToBp(values.taxRate),
    taxLabel: values.taxLabel || "Tax",
  };
}

interface EditorProps {
  // The editor only touches PricingValues fields; callers' forms extend that shape.
  control: Control<never>;
  register: UseFormRegister<never>;
  setValue: UseFormSetValue<never>;
  errors: FieldErrors<PricingValues>;
}

export function LineItemsEditor({
  control,
  register: registerAny,
  setValue: setValueAny,
  errors,
}: EditorProps) {
  const register = registerAny as unknown as UseFormRegister<PricingValues>;
  const setValue = setValueAny as unknown as UseFormSetValue<PricingValues>;
  const typedControl = control as unknown as Control<PricingValues>;
  const { fields, append, remove } = useFieldArray({ control: typedControl, name: "items" });
  const { services, options } = useServiceOptions();
  const watched = useWatch({ control: typedControl }) as Partial<PricingValues>;

  const applyService = (index: number, id: string) => {
    const service: Service | undefined = services.find((s) => s._id === id);
    if (!service) return;
    setValue(`items.${index}.description`, service.name, { shouldValidate: true });
    // A catalogue price in another currency would be wrong here, so only matching prices prefill.
    if (service.currency === watched.currency && service.startingPrice > 0) {
      setValue(`items.${index}.unitPrice`, fromMinor(service.startingPrice), {
        shouldValidate: true,
      });
    }
  };

  // Totals come from the server, so there is one calculation for preview, storage and PDF.
  const request = useMemo(() => {
    try {
      const items = (watched.items ?? []).map((item) => ({
        quantity: isQuantityValid(item?.quantity ?? "") ? Number(item?.quantity) : 0.001,
        unitPrice: isPriceValid(item?.unitPrice ?? "") ? toMinor(item?.unitPrice) : 0,
      }));
      const { discount, taxRateBp } = pricingPayload({
        items: [],
        discountType: watched.discountType ?? "PERCENT",
        discountValue: watched.discountValue ?? "",
        taxRate: watched.taxRate ?? "",
        taxLabel: "",
        currency: "",
      });
      return JSON.stringify({ items, discount, taxRateBp });
    } catch {
      return null;
    }
  }, [watched.items, watched.discountType, watched.discountValue, watched.taxRate]);
  const debounced = useDebounce(request, 350);

  const preview = useApiMutation<string, Totals>({
    request: (body) => api.post("/invoices/preview-totals", JSON.parse(body)),
    invalidate: [],
    toastSuccess: false,
    toastError: false,
  });
  const { mutate } = preview;
  useEffect(() => {
    if (debounced) mutate(debounced);
  }, [debounced, mutate]);
  const totals = preview.data as Totals | undefined;
  const currency = watched.currency ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {fields.map((field, index) => {
          const itemErrors = errors.items?.[index];
          const lineAmount = totals?.lineAmounts[index];
          return (
            <div
              key={field.id}
              className="grid grid-cols-6 items-start gap-2 rounded-lg border border-line p-3 lg:grid-cols-12"
              data-testid="line-item"
            >
              <FormField label="Service" className="col-span-6 lg:col-span-3">
                {(f) => (
                  <Select
                    {...f}
                    {...register(`items.${index}.service`, {
                      onChange: (e) => applyService(index, e.target.value),
                    })}
                    options={options}
                    placeholder="Custom"
                  />
                )}
              </FormField>
              <FormField
                label="Description"
                required
                className="col-span-6 lg:col-span-4"
                error={itemErrors?.description?.message}
              >
                {(f) => <Input {...f} {...register(`items.${index}.description`)} />}
              </FormField>
              <FormField
                label="Qty"
                required
                className="col-span-2 lg:col-span-1"
                error={itemErrors?.quantity?.message}
              >
                {(f) => (
                  <Input inputMode="decimal" {...f} {...register(`items.${index}.quantity`)} />
                )}
              </FormField>
              <FormField
                label="Unit price"
                required
                className="col-span-2 lg:col-span-2"
                error={itemErrors?.unitPrice?.message}
              >
                {(f) => (
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    {...f}
                    {...register(`items.${index}.unitPrice`)}
                  />
                )}
              </FormField>
              <div className="col-span-2 flex items-end justify-between gap-1 lg:col-span-2">
                <div className="min-w-0">
                  <p className="mb-1 text-[13px] font-medium text-ink-2">Amount</p>
                  <p className="tabular flex h-9 items-center whitespace-nowrap text-[13px]">
                    {lineAmount !== undefined ? fromMinor(lineAmount) : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mb-0.5"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  icon={<Trash2 className="size-4" />}
                />
              </div>
            </div>
          );
        })}
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => append(emptyLine)}>
          Add line
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 self-start">
          <FormField label="Discount type">
            {(f) => (
              <Select
                {...f}
                {...register("discountType")}
                options={[
                  { value: "PERCENT", label: "Percent" },
                  { value: "FIXED", label: "Fixed amount" },
                ]}
              />
            )}
          </FormField>
          <FormField label="Discount" error={errors.discountValue?.message}>
            {(f) => (
              <Input inputMode="decimal" placeholder="0" {...f} {...register("discountValue")} />
            )}
          </FormField>
          <FormField label="Tax name" hint="GST, VAT...">
            {(f) => <Input {...f} {...register("taxLabel")} />}
          </FormField>
          <FormField label="Tax rate %" error={errors.taxRate?.message}>
            {(f) => <Input inputMode="decimal" placeholder="0" {...f} {...register("taxRate")} />}
          </FormField>
        </div>
        <dl
          className="tabular space-y-1.5 rounded-lg bg-surface-2 p-4 text-[13px]"
          aria-label="Totals calculated by the server"
        >
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd>{formatMoney(totals?.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Discount</dt>
            <dd>-{formatMoney(totals?.discountAmount, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">{watched.taxLabel || "Tax"}</dt>
            <dd>{formatMoney(totals?.taxAmount, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line-strong pt-1.5 text-base font-semibold">
            <dt>Total</dt>
            <dd data-testid="total">{formatMoney(totals?.total, currency)}</dd>
          </div>
          {preview.error && <p className="text-bad">{preview.error.message}</p>}
        </dl>
      </div>
    </div>
  );
}
