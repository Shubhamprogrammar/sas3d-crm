"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Tabs,
  useToast,
} from "@/components/ui";
import {
  ChartCard,
  minorToMajorForChart,
  periodLabel,
  RankedBars,
  TimeArea,
  TimeColumns,
} from "@/components/charts/charts";
import { CurrencySelect } from "@/features/dashboard/currency-select";
import { RangeFilter, rangeParams, type RangeValue } from "@/features/dashboard/range-filter";
import { useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { downloadFile } from "@/services/api";
import type { CountRow, MoneyRow } from "@/types";
import { formatMoney } from "@/utils/money";

function Tile({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs text-ink-2">{title}</p>
      <p className="tabular mt-1 text-2xl font-normal">{value}</p>
    </Card>
  );
}

const rowsOf = (rows: CountRow[] = [], pretty = true) =>
  rows.map((r) => ({ label: pretty ? label(r.key) : r.key, value: r.count }));

interface SalesData {
  leadsGenerated: number;
  converted: number;
  won: number;
  lost: number;
  winRate: number;
  bySource: CountRow[];
  byCountry: CountRow[];
  monthly: { period: string; count: number }[];
  lostReasons: CountRow[];
}
function SalesReport({ params }: { params: object }) {
  const { data, isLoading, error, refetch } = useApiQuery<SalesData>("/reports/sales", params);
  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const monthly = data.monthly.map((r) => ({ label: periodLabel(r.period), value: r.count }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile title="Leads generated" value={data.leadsGenerated} />
        <Tile title="Converted to clients" value={data.converted} />
        <Tile title="Won" value={data.won} />
        <Tile title="Lost" value={data.lost} />
        <Tile title="Win rate" value={`${data.winRate}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          className="lg:col-span-2"
          height={320}
          title="Leads over time"
          valueHeader="Leads"
          rows={monthly}
        >
          <TimeColumns rows={monthly} />
        </ChartCard>
        <ChartCard title="Leads by source" valueHeader="Leads" rows={rowsOf(data.bySource)}>
          <RankedBars rows={rowsOf(data.bySource)} />
        </ChartCard>
        <ChartCard
          title="Leads by country"
          valueHeader="Leads"
          rows={rowsOf(data.byCountry, false)}
        >
          <RankedBars rows={rowsOf(data.byCountry, false)} />
        </ChartCard>
        <ChartCard title="Lost reasons" valueHeader="Count" rows={rowsOf(data.lostReasons, false)}>
          <RankedBars rows={rowsOf(data.lostReasons, false)} />
        </ChartCard>
      </div>
    </div>
  );
}

interface FinanceData {
  financials: MoneyRow[];
  monthly: { period: string; currency: string; amount: number }[];
  byService: { service: string; currency: string; amount: number }[];
  byClient: { client: string; currency: string; invoiced: number; outstanding: number }[];
  payments: {
    _id: string;
    paymentDate: string;
    amount: number;
    currency: string;
    method: string;
    invoice: { number: string } | null;
    client: { name: string } | null;
  }[];
  openInvoices: {
    _id: string;
    number: string;
    currency: string;
    amountDue: number;
    dueDate: string;
    status: string;
    client: { name: string } | null;
  }[];
}
function FinanceReport({ params }: { params: object }) {
  const { preferences } = useMe();
  const format = useFormat();
  const [chosen, setChosen] = useState("");
  const { data, isLoading, error, refetch } = useApiQuery<FinanceData>("/reports/finance", params);
  const currencies = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.financials ?? []).map((r) => r.currency),
          ...(data?.monthly ?? []).map((r) => r.currency),
        ]),
      ].sort(),
    [data],
  );
  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const currency =
    chosen && currencies.includes(chosen)
      ? chosen
      : currencies.includes(preferences.defaultCurrency)
        ? preferences.defaultCurrency
        : (currencies[0] ?? preferences.defaultCurrency);
  const money = (major: number) =>
    `${currency} ${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monthly = data.monthly
    .filter((r) => r.currency === currency)
    .map((r) => ({ label: periodLabel(r.period), value: minorToMajorForChart(r.amount) }));
  const byService = data.byService
    .filter((r) => r.currency === currency)
    .map((r) => ({ label: r.service, value: minorToMajorForChart(r.amount) }));
  const picker = <CurrencySelect currencies={currencies} value={currency} onChange={setChosen} />;
  return (
    <div className="space-y-4">
      <Card title="Totals by currency" padded={false}>
        <DataTable
          rows={data.financials}
          rowKey={(r) => r.currency}
          empty={<p className="p-6 text-center text-ink-2">No financial records in this period</p>}
          columns={[
            {
              key: "c",
              header: "Currency",
              render: (r) => <span className="font-medium">{r.currency}</span>,
            },
            {
              key: "i",
              header: "Invoiced",
              align: "right",
              render: (r) => (
                <span className="font-mono">
                  <span className="font-mono">{formatMoney(r.invoiced, r.currency)}</span>
                </span>
              ),
            },
            {
              key: "p",
              header: "Collected",
              align: "right",
              render: (r) => (
                <span className="font-mono">
                  <span className="font-mono">{formatMoney(r.collected, r.currency)}</span>
                </span>
              ),
            },
            {
              key: "o",
              header: "Outstanding (today)",
              align: "right",
              render: (r) => (
                <span className="font-mono">
                  <span className="font-mono">{formatMoney(r.outstanding, r.currency)}</span>
                </span>
              ),
            },
          ]}
        />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          className="lg:col-span-2"
          height={320}
          title="Revenue collected over time"
          valueHeader="Collected"
          rows={monthly}
          format={money}
          action={picker}
        >
          <TimeArea rows={monthly} format={money} />
        </ChartCard>
        <ChartCard
          title="Invoiced by service"
          valueHeader="Invoiced"
          rows={byService}
          format={money}
          action={picker}
        >
          <RankedBars rows={byService} format={money} />
        </ChartCard>
      </div>
      <Card title="Revenue by client" padded={false}>
        <DataTable
          rows={data.byClient}
          rowKey={(r) => `${r.client}-${r.currency}`}
          empty={<p className="p-6 text-center text-ink-2">No invoices in this period</p>}
          columns={[
            { key: "c", header: "Client", render: (r) => r.client },
            {
              key: "i",
              header: "Invoiced",
              align: "right",
              render: (r) => (
                <span className="font-mono">
                  <span className="font-mono">{formatMoney(r.invoiced, r.currency)}</span>
                </span>
              ),
            },
            {
              key: "o",
              header: "Outstanding",
              align: "right",
              render: (r) => (
                <span className="font-mono">
                  <span className="font-mono">{formatMoney(r.outstanding, r.currency)}</span>
                </span>
              ),
            },
          ]}
        />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Outstanding invoices" padded={false}>
          <DataTable
            rows={data.openInvoices}
            rowKey={(r) => r._id}
            empty={<p className="p-6 text-center text-ink-2">Nothing outstanding</p>}
            columns={[
              {
                key: "n",
                header: "Invoice",
                render: (r) => (
                  <div>
                    <p className="font-mono text-xs font-medium">{r.number}</p>
                    <p className="text-xs text-ink-3">{r.client?.name}</p>
                  </div>
                ),
              },
              {
                key: "d",
                header: "Due",
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-mono">{format.day(r.dueDate)}</span>
                  </span>
                ),
              },
              { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
              {
                key: "a",
                header: "Balance",
                align: "right",
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-mono">{formatMoney(r.amountDue, r.currency)}</span>
                  </span>
                ),
              },
            ]}
          />
        </Card>
        <Card title="Payments received" padded={false}>
          <DataTable
            rows={data.payments}
            rowKey={(r) => r._id}
            empty={<p className="p-6 text-center text-ink-2">No payments in this period</p>}
            columns={[
              {
                key: "d",
                header: "Date",
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-mono">{format.day(r.paymentDate)}</span>
                  </span>
                ),
              },
              {
                key: "i",
                header: "Invoice",
                render: (r) => (
                  <div>
                    <p className="font-mono text-xs font-medium">{r.invoice?.number}</p>
                    <p className="text-xs text-ink-3">{r.client?.name}</p>
                  </div>
                ),
              },
              { key: "m", header: "Method", render: (r) => label(r.method) },
              {
                key: "a",
                header: "Amount",
                align: "right",
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-mono">{formatMoney(r.amount, r.currency)}</span>
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

interface ProjectsData {
  active: number;
  completed: number;
  delayedCount: number;
  byStatus: CountRow[];
  delivery: { measured: number; onTime: number; late: number; onTimeRate: number };
  delayed: {
    _id: string;
    name: string;
    code: string;
    status: string;
    expectedDeliveryDate: string;
    client: { name: string } | null;
    projectManager: { name: string } | null;
  }[];
}
function ProjectsReport({ params }: { params: object }) {
  const format = useFormat();
  const { data, isLoading, error, refetch } = useApiQuery<ProjectsData>(
    "/reports/projects",
    params,
  );
  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile title="Active" value={data.active} />
        <Tile title="Completed in period" value={data.completed} />
        <Tile title="Delayed" value={data.delayedCount} />
        <Tile
          title="Delivered on time"
          value={
            data.delivery.measured
              ? `${data.delivery.onTimeRate}% of ${data.delivery.measured}`
              : "No data"
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Projects by status" valueHeader="Projects" rows={rowsOf(data.byStatus)}>
          <RankedBars rows={rowsOf(data.byStatus)} />
        </ChartCard>
        <Card title="Delayed projects" padded={false}>
          <DataTable
            rows={data.delayed}
            rowKey={(r) => r._id}
            empty={<p className="p-6 text-center text-ink-2">No delayed projects</p>}
            columns={[
              {
                key: "n",
                header: "Project",
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-ink-3">{r.client?.name}</p>
                  </div>
                ),
              },
              { key: "m", header: "Manager", render: (r) => r.projectManager?.name },
              {
                key: "d",
                header: "Expected",
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-mono">{format.day(r.expectedDeliveryDate)}</span>
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

interface TeamData {
  members: {
    id: string;
    name: string;
    role: string;
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
  }[];
}
function TeamReport({ params }: { params: object }) {
  const { data, isLoading, error, refetch } = useApiQuery<TeamData>("/reports/team", params);
  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const workload = data.members.map((m) => ({ label: m.name, value: m.pending }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Pending tasks by member" valueHeader="Pending" rows={workload}>
        <RankedBars rows={workload} />
      </ChartCard>
      <Card title="Workload" padded={false}>
        <DataTable
          rows={data.members}
          rowKey={(m) => m.id}
          empty={<p className="p-6 text-center text-ink-2">No assigned tasks</p>}
          columns={[
            {
              key: "n",
              header: "Member",
              render: (m) => (
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-ink-3">{label(m.role)}</p>
                </div>
              ),
            },
            { key: "a", header: "Assigned", align: "right", render: (m) => m.assigned },
            { key: "c", header: "Completed", align: "right", render: (m) => m.completed },
            { key: "p", header: "Pending", align: "right", render: (m) => m.pending },
            { key: "o", header: "Overdue", align: "right", render: (m) => m.overdue },
          ]}
        />
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const { can, me } = useMe();
  const toast = useToast();
  const [range, setRange] = useState<RangeValue>({ preset: "this_year", from: "", to: "" });
  const [chosen, setChosen] = useState("");
  if (!me) return <LoadingSkeleton />;
  const tabs = [
    { key: "sales", label: "Sales", hidden: !can("report:sales") },
    { key: "finance", label: "Finance", hidden: !can("report:finance") },
    { key: "projects", label: "Projects", hidden: !can("report:projects") },
    { key: "team", label: "Team", hidden: !can("report:team") },
  ].filter((t) => !t.hidden);
  const tab = chosen || tabs[0]?.key || "";
  const params = rangeParams(range);
  if (!tabs.length) return <ErrorState error={new Error("You do not have access to reports.")} />;
  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <>
            <RangeFilter value={range} onChange={setRange} />
            <Button
              icon={<Download className="size-4" />}
              onClick={() =>
                downloadFile(`/reports/${tab}`, `${tab}-report.csv`, {
                  ...params,
                  format: "csv",
                }).catch((e: Error) => toast.error(e.message))
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <Tabs tabs={tabs} active={tab} onChange={setChosen} />
      </div>
      {tab === "sales" && <SalesReport params={params} />}
      {tab === "finance" && <FinanceReport params={params} />}
      {tab === "projects" && <ProjectsReport params={params} />}
      {tab === "team" && <TeamReport params={params} />}
    </>
  );
}
