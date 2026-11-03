"use client";

import { Select } from "@/components/ui";

/** Money charts show one currency at a time, because no exchange rate is configured to combine them. */
export function CurrencySelect({
  currencies,
  value,
  onChange,
}: {
  currencies: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (currencies.length < 2) return <span className="text-xs text-ink-3">{value}</span>;
  return (
    <Select
      aria-label="Currency"
      className="w-24"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={currencies.map((c) => ({ value: c, label: c }))}
    />
  );
}
