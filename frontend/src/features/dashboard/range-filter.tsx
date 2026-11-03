"use client";

import { DatePicker, Select } from "@/components/ui";
import { RANGE_PRESETS } from "@/lib/constants";

export interface RangeValue {
  preset: string;
  from: string;
  to: string;
}

export const rangeParams = ({ preset, from, to }: RangeValue) => ({
  preset,
  ...(preset === "custom" ? { ...(from ? { from } : {}), ...(to ? { to } : {}) } : {}),
});

export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Date range"
        className="w-40"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value })}
        options={RANGE_PRESETS}
      />
      {value.preset === "custom" && (
        <>
          <DatePicker
            aria-label="From"
            className="w-38"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <DatePicker
            aria-label="To"
            className="w-38"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
