"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Card, ErrorState, PageHeader, ProgressBar, Skeleton, StatusBadge } from "@/components/ui";
import {
  ChartCard,
  minorToMajorForChart,
  periodLabel,
  RankedBars,
  TimeArea,
  TimeColumns,
} from "@/components/charts/charts";
import { CurrencySelect } from "@/features/dashboard/currency-select";
import { InvoiceSheet } from "@/features/dashboard/invoice-sheet";
import { RangeFilter, rangeParams, type RangeValue } from "@/features/dashboard/range-filter";
import { useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import type { CountRow, Dashboard } from "@/types";
import { formatMoney } from "@/utils/money";

function Stat({
  title,
  value,
  note,
  href,
}: {
  title: string;
  value: ReactNode;
  note?: string;
  href?: string;
}) {
  const body = (
    <div className={`h-full bg-surface p-4 ${href ? "transition-colors hover:bg-surface-2" : ""}`}>
      <p className="text-xs text-ink-2">{title}</p>
      <p className="tabular mt-1 text-2xl font-medium" data-testid={`stat-${title}`}>
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-3">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Related figures share one panel. Width follows the count, so rows always fill without a gap. */
function StatGroup({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div
      className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(136px,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card max-sm:[&>:last-child:nth-child(odd)]:col-span-full"
      style={{ flex: `${count} 1 ${count * 160}px` }}
    >
      {children}
    </div>
  );
}

/** Names the selected period, with the year quiet. Ranges without one name stay "Dashboard". */
function periodTitle(preset: string, from: string | undefined, timeZone: string): ReactNode {
  if (!from) return "Dashboard";
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(new Date(from));
  const year = part({ year: "numeric" });
  const named =
    preset === "this_month" || preset === "last_month"
      ? part({ month: "long" })
      : preset === "today"
        ? part({ day: "numeric", month: "long" })
        : null;
  if (preset === "this_year") return <span className="text-4xl font-normal">{year}</span>;
  if (!named) return "Dashboard";
  return (
    <span className="text-4xl font-normal">
      {named} <span className="text-ink-3">{year}</span>
    </span>
  );
}

const MONEY_CELL =
  "flex justify-between gap-3 px-4 py-2 text-right before:text-ink-2 before:content-[attr(data-label)]";

const toRows = (rows: CountRow[] | undefined) =>
  (rows ?? []).map((r) => ({ label: label(r.key), value: r.count }));
const plainRows = (rows: CountRow[] | undefined) =>
  (rows ?? []).map((r) => ({ label: r.key, value: r.count }));

export default function DashboardPage() {
  const { preferences } = useMe();
  const format = useFormat();
  const [range, setRange] = useState<RangeValue>({ preset: "this_month", from: "", to: "" });
  const [chosenCurrency, setChosenCurrency] = useState("");
  const { data, isLoading, error, refetch } = useApiQuery<Dashboard>(
    "/dashboard",
    rangeParams(range),
    { keepPrevious: true },
  );

  const finance = data?.finance;
  const currencies = useMemo(() => {
    const found = new Set<string>();
    finance?.byCurrency.forEach((row) => found.add(row.currency));
    finance?.revenueOverTime.forEach((row) => found.add(row.currency));
    finance?.revenueByService.forEach((row) => found.add(row.currency));
    return [...found].sort();
  }, [finance]);
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : currencies.includes(preferences.defaultCurrency)
        ? preferences.defaultCurrency
        : (currencies[0] ?? preferences.defaultCurrency);
  const money = (major: number) =>
    `${currency} ${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (error && !data) return <ErrorState error={error} onRetry={refetch} />;

  const { leads, clients, projects, tasks, proposals } = data ?? {};
  const leadRows = (leads?.overTime ?? []).map((r) => ({
    label: periodLabel(r.period),
    value: r.count,
  }));
  const revenue = (finance?.revenueOverTime ?? []).filter((r) => r.currency === currency);
  const revenueRows = revenue.map((r) => ({
    label: periodLabel(r.period),
    value: minorToMajorForChart(r.amount),
  }));
  const headline = finance?.byCurrency.find((row) => row.currency === currency);
  const serviceRows = (finance?.revenueByService ?? [])
    .filter((r) => r.currency === currency)
    .slice(0, 8)
    .map((r) => ({ label: r.service, value: minorToMajorForChart(r.amount) }));
  const smallChart = "flex-[1_1_20rem]";

  return (
    <>
      <PageHeader
        title={periodTitle(range.preset, data?.range.from, preferences.timezone)}
        description="Period filter applies to new leads, proposals, revenue and charts, totals stay current"
        actions={<RangeFilter value={range} onChange={setRange} />}
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {finance && (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-xl border border-line bg-surface p-6 shadow-card">
                <h2 className="text-[13px] text-ink-2">Collected</h2>
                <p className="tabular mt-2 text-4xl font-normal">
                  {formatMoney(headline?.collected, currency)}
                </p>
                <p className="mt-2 text-xs text-ink-3">In this period</p>
              </section>
              <section className="relative overflow-hidden sm:min-h-44 rounded-xl border border-line bg-surface p-6 shadow-card lg:col-span-2">
                <h2 className="text-[13px] text-ink-2">Outstanding</h2>
                <p className="tabular mt-2 text-4xl font-normal">
                  {formatMoney(headline?.outstanding, currency)}
                </p>
                <p className="mt-2 text-xs text-ink-3">As of today</p>
                <InvoiceSheet invoice={finance.openInvoices.find((i) => i.currency === currency)} />
              </section>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {leads && (
              <StatGroup count={4}>
                <Stat title="Total leads" value={leads.total} href="/leads" />
                <Stat title="New leads" value={leads.newInRange} note="In this period" />
                <Stat title="Active leads" value={leads.active} href="/pipeline" />
                <Stat title="Overdue follow-ups" value={leads.overdueFollowUps} href="/leads" />
              </StatGroup>
            )}
            {clients && (
              <StatGroup count={2}>
                <Stat title="Total clients" value={clients.total} href="/clients" />
                <Stat title="Active clients" value={clients.active} />
              </StatGroup>
            )}
            {(projects || tasks) && (
              <StatGroup count={(projects ? 2 : 0) + (tasks ? 1 : 0)}>
                {projects && (
                  <Stat title="Active projects" value={projects.active} href="/projects" />
                )}
                {projects && <Stat title="Completed projects" value={projects.completed} />}
                {tasks && (
                  <Stat
                    title="Pending tasks"
                    value={tasks.pending}
                    note={tasks.overdue ? `${tasks.overdue} overdue` : undefined}
                    href="/tasks"
                  />
                )}
              </StatGroup>
            )}
            {proposals && (
              <StatGroup count={2}>
                <Stat
                  title="Proposals sent"
                  value={proposals.sent}
                  note="In this period"
                  href="/proposals"
                />
                <Stat
                  title="Proposal conversion"
                  value={`${proposals.conversionRate}%`}
                  note={`${proposals.accepted} accepted`}
                />
              </StatGroup>
            )}
          </div>

          {finance && (
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="Revenue collected"
                rows={revenueRows}
                format={money}
                valueHeader="Collected"
                height={320}
                action={
                  <CurrencySelect
                    currencies={currencies}
                    value={currency}
                    onChange={setChosenCurrency}
                  />
                }
              >
                <TimeArea rows={revenueRows} format={money} />
              </ChartCard>
              <Card title="Revenue by currency" padded={false}>
                {finance.byCurrency.length ? (
                  <table
                    role="table"
                    className="tabular block w-full text-[13px]"
                    data-testid="finance-table"
                  >
                    <thead role="rowgroup" className="sr-only">
                      <tr role="row">
                        <th role="columnheader">Currency</th>
                        <th role="columnheader">Invoiced (period)</th>
                        <th role="columnheader">Collected (period)</th>
                        <th role="columnheader">Outstanding (today)</th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup" className="block divide-y divide-line">
                      {finance.byCurrency.map((row) => (
                        <tr
                          key={row.currency}
                          role="row"
                          className="block py-1"
                          data-currency={row.currency}
                        >
                          <td role="cell" className="block px-4 py-2 font-medium">
                            {row.currency}
                          </td>
                          <td role="cell" className={MONEY_CELL} data-label="Invoiced (period)">
                            {formatMoney(row.invoiced, row.currency)}
                          </td>
                          <td role="cell" className={MONEY_CELL} data-label="Collected (period)">
                            {formatMoney(row.collected, row.currency)}
                          </td>
                          <td role="cell" className={MONEY_CELL} data-label="Outstanding (today)">
                            {formatMoney(row.outstanding, row.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">No issued invoices yet</p>
                )}
                <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
                  Currencies are never added together, as no exchange rate is configured
                </p>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            {leads && (
              <ChartCard
                className={smallChart}
                title="Lead generation"
                rows={leadRows}
                valueHeader="Leads"
                height={220}
              >
                <TimeColumns rows={leadRows} />
              </ChartCard>
            )}
            {leads && (
              <ChartCard
                className={smallChart}
                title="Leads by source"
                rows={toRows(leads.bySource)}
                valueHeader="Leads"
                height={220}
              >
                <RankedBars rows={toRows(leads.bySource)} />
              </ChartCard>
            )}
            {leads && (
              <ChartCard
                className={smallChart}
                title="Leads by country"
                rows={plainRows(leads.byCountry)}
                valueHeader="Leads"
                height={220}
              >
                <RankedBars rows={plainRows(leads.byCountry)} />
              </ChartCard>
            )}
            {projects && (
              <ChartCard
                className={smallChart}
                title="Projects by status"
                rows={toRows(projects.statusDistribution)}
                valueHeader="Projects"
                height={220}
              >
                <RankedBars rows={toRows(projects.statusDistribution)} />
              </ChartCard>
            )}
            {finance && (
              <ChartCard
                className={smallChart}
                title="Invoiced by service"
                rows={serviceRows}
                format={money}
                valueHeader="Invoiced"
                height={220}
                action={
                  <CurrencySelect
                    currencies={currencies}
                    value={currency}
                    onChange={setChosenCurrency}
                  />
                }
              >
                <RankedBars rows={serviceRows} format={money} />
              </ChartCard>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {leads && (
              <Card title="Upcoming follow-ups" padded={false}>
                {leads.upcomingFollowUps.length ? (
                  <ul className="divide-y divide-line">
                    {leads.upcomingFollowUps.map((l) => {
                      const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date();
                      return (
                        <li
                          key={l._id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <Link
                            href={`/leads/${l._id}`}
                            className="min-w-0 truncate font-medium hover:underline"
                          >
                            {l.fullName}
                          </Link>
                          <span
                            className={`shrink-0 text-xs ${overdue ? "font-medium text-bad" : "text-ink-2"}`}
                          >
                            {format.dateTime(l.nextFollowUpAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">Nothing scheduled</p>
                )}
              </Card>
            )}
            {tasks && (
              <Card title="Upcoming tasks" padded={false}>
                {tasks.upcoming.length ? (
                  <ul className="divide-y divide-line">
                    {tasks.upcoming.map((t) => (
                      <li
                        key={t._id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <Link
                          href={`/tasks?task=${t._id}`}
                          className="min-w-0 truncate font-medium hover:underline"
                        >
                          {t.title}
                        </Link>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-2">
                          {format.date(t.dueAt)}
                          <StatusBadge status={t.priority} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">No open tasks with due dates</p>
                )}
              </Card>
            )}
            {leads && (
              <Card title="Recent leads" padded={false}>
                {leads.recent.length ? (
                  <ul className="divide-y divide-line">
                    {leads.recent.map((l) => (
                      <li
                        key={l._id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <Link href={`/leads/${l._id}`} className="min-w-0 truncate hover:underline">
                          <span className="font-medium">{l.fullName}</span>{" "}
                          <span className="text-xs text-ink-3">
                            {[l.companyName, l.country].filter(Boolean).join(" · ")}
                          </span>
                        </Link>
                        <StatusBadge status={l.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">No leads yet</p>
                )}
              </Card>
            )}
            {projects && (
              <Card title="Active projects" padded={false}>
                {projects.activeList.length ? (
                  <ul className="divide-y divide-line">
                    {projects.activeList.map((p) => (
                      <li
                        key={p._id}
                        className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 px-4 py-2.5"
                      >
                        <Link
                          href={`/projects/${p._id}`}
                          className="min-w-0 truncate hover:underline"
                        >
                          <span className="font-mono text-xs text-ink-2">{p.code}</span>{" "}
                          <span className="font-medium">{p.name}</span>{" "}
                          <span className="text-xs text-ink-3">{p.client?.name}</span>
                        </Link>
                        <ProgressBar value={p.progress} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">No active projects</p>
                )}
              </Card>
            )}
            {finance && (
              <Card title="Outstanding invoices" padded={false}>
                {finance.openInvoices.length ? (
                  <ul className="divide-y divide-line">
                    {finance.openInvoices.map((i) => (
                      <li
                        key={i._id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                      >
                        <Link
                          href={`/invoices/${i._id}`}
                          className="min-w-0 truncate hover:underline"
                        >
                          <span className="font-mono text-xs font-medium">{i.number}</span>{" "}
                          <span className="text-xs text-ink-3">{i.client?.name}</span>
                        </Link>
                        <span className="flex items-center gap-2">
                          <span className="tabular text-[13px]">
                            {formatMoney(i.amountDue, i.currency)}
                          </span>
                          <StatusBadge status={i.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-ink-2">Nothing outstanding</p>
                )}
              </Card>
            )}
            <Card title="Recent activity" padded={false}>
              {data?.recentActivities.length ? (
                <ul className="divide-y divide-line">
                  {data.recentActivities.map((a) => (
                    <li key={a._id} className="px-4 py-2.5">
                      <p className="line-clamp-2">{a.description}</p>
                      <p className="text-xs text-ink-3">
                        {a.actor?.name ?? "System"} · {format.dateTime(a.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-ink-2">No activity yet</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
