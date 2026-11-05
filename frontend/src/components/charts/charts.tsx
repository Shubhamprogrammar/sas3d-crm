"use client";

import { Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, EmptyState } from "@/components/ui";

const AXIS = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--text-3)" };
const CURSOR = { fill: "var(--surface-2)" };

function ChartTooltip({
  active,
  payload,
  label: heading,
  format,
}: {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: string | number;
  format: (value: number) => string;
}) {
  const value = payload?.[0]?.value;
  if (!active || value === undefined) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
      <p className="text-ink-2">{heading}</p>
      <p className="tabular font-medium text-ink">{format(Number(value))}</p>
    </div>
  );
}

export interface ChartRow {
  label: string;
  value: number;
}

/** Every chart can switch to a table, so no figure depends on seeing color or hovering. */
export function ChartCard({
  title,
  rows,
  format = String,
  valueHeader = "Value",
  children,
  action,
  height = 240,
  className = "",
}: {
  title: string;
  rows: ChartRow[];
  format?: (value: number) => string;
  valueHeader?: string;
  children: ReactNode;
  action?: ReactNode;
  height?: number;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section
      className={`min-w-0 rounded-xl border border-line bg-surface shadow-card ${className}`}
    >
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <h2 className="font-medium">{title}</h2>
        <div className="flex items-center gap-1.5">
          {action}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${asTable ? "Show chart" : "Show table"} for ${title}`}
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
            icon={<Table2 className="size-4" />}
          />
        </div>
      </header>
      {!rows.length ? (
        <EmptyState title="No data in this period" />
      ) : asTable ? (
        <div className="overflow-y-auto px-4 pb-3" style={{ maxHeight: height }}>
          <table className="tabular w-full text-[13px]">
            <thead className="text-xs text-ink-3">
              <tr>
                <th className="py-1 text-left font-medium">Name</th>
                <th className="text-right font-medium">{valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="py-1">{row.label}</td>
                  <td className="text-right">{format(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pb-2" style={{ height }}>
          {children}
        </div>
      )}
    </section>
  );
}

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** Horizontal bars for ranked categories, sorted by the data, labels readable at any length. */
export function RankedBars({
  rows,
  format = String,
}: {
  rows: ChartRow[];
  format?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
        barCategoryGap={5}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => compact(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={118}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
        />
        <Tooltip
          cursor={CURSOR}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              format={format}
            />
          )}
        />
        <Bar
          dataKey="value"
          fill="var(--bar)"
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimeColumns({
  rows,
  format = String,
}: {
  rows: ChartRow[];
  format?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        barCategoryGap="25%"
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={AXIS}
          axisLine={{ stroke: "var(--border-strong)" }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip
          cursor={CURSOR}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              format={format}
            />
          )}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {rows.map((row, index) => (
            <Cell
              key={row.label}
              fill={index === rows.length - 1 ? "var(--accent)" : "var(--bar)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimeArea({
  rows,
  format = String,
}: {
  rows: ChartRow[];
  format?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 28, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={AXIS}
          axisLine={{ stroke: "var(--border-strong)" }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)" }}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              format={format}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="var(--accent)"
          fillOpacity={0.14}
          dot={rows.length === 1 ? { r: 4, fill: "var(--accent)" } : false}
          activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Reads the API's "YYYY-MM" and "YYYY-MM-DD" buckets as text, so no timezone can shift them. */
export function periodLabel(period: string) {
  const [year, month, day] = period.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!name) return period;
  return day ? `${day} ${name}` : `${name} ${year}`;
}

/** Chart geometry needs plain numbers; exact money stays in integer minor units everywhere else. */
export const minorToMajorForChart = (minor: number) => minor / 100;
