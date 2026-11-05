"use client";

import { Archive, FileText, FolderKanban, Pencil, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  DetailList,
  Dropdown,
  EmptyState,
  ErrorState,
  ExternalLink,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  StatusBadge,
  Tabs,
  UserChip,
  type Column,
} from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { ActivityTimeline } from "@/features/shared/activity-timeline";
import { AttachmentsPanel } from "@/features/shared/attachments-panel";
import { useApiList, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { api } from "@/services/api";
import type { Client, Invoice, Payment, Project, Proposal } from "@/types";
import { formatMoney } from "@/utils/money";

function Related<T extends { _id: string }>({
  path,
  params,
  columns,
  empty,
  href,
}: {
  path: string | null;
  params: object;
  columns: Column<T>[];
  empty: { icon: typeof FileText; title: string };
  href?: (row: T) => string;
}) {
  const router = useRouter();
  const { items, isLoading, error, refetch } = useApiList<T>(path, { ...params, limit: 50 });
  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={(r) => r._id}
      loading={isLoading}
      error={error}
      onRetry={refetch}
      onRowClick={href ? (r) => router.push(href(r)) : undefined}
      empty={<EmptyState icon={empty.icon} title={empty.title} />}
    />
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { data: client, isLoading, error, refetch } = useApiQuery<Client>(`/clients/${id}`);
  const archive = useApiMutation({
    request: () => api.delete(`/clients/${id}`),
    invalidate: ["/clients", "/dashboard"],
    onSuccess: () => router.push("/clients"),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !client) return <ErrorState error={error} onRetry={refetch} />;

  const address = client.billingAddress;
  const canFinance = can("invoice:read");
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "projects", label: "Projects", count: client.summary?.totalProjects },
    { key: "proposals", label: "Proposals", hidden: !can("proposal:read") },
    { key: "invoices", label: "Invoices", hidden: !canFinance },
    { key: "payments", label: "Payments", hidden: !can("payment:read") },
    { key: "communication", label: "Communication" },
    { key: "activities", label: "Activities" },
    { key: "documents", label: "Documents" },
  ].filter((t) => !t.hidden);

  const projectColumns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      render: (p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="font-mono text-xs text-ink-3">{p.code}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "progress",
      header: "Progress",
      render: (p) => (
        <div className="w-32">
          <ProgressBar value={p.progress} />
        </div>
      ),
    },
    {
      key: "due",
      header: "Expected delivery",
      render: (p) => <span className="font-mono">{format.day(p.expectedDeliveryDate)}</span>,
    },
  ];
  const proposalColumns: Column<Proposal>[] = [
    {
      key: "number",
      header: "Number",
      render: (p) => <span className="font-mono text-xs font-medium">{p.number}</span>,
    },
    { key: "title", header: "Title", render: (p) => p.title },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (p) => (
        <span className="font-mono">
          <span className="font-mono">{formatMoney(p.total, p.currency)}</span>
        </span>
      ),
    },
  ];
  const invoiceColumns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Number",
      render: (i) => <span className="font-mono text-xs font-medium">{i.number}</span>,
    },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
    {
      key: "due",
      header: "Due",
      render: (i) => <span className="font-mono">{format.day(i.dueDate)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (i) => (
        <span className="font-mono">
          <span className="font-mono">{formatMoney(i.total, i.currency)}</span>
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (i) => (
        <span className="font-mono">
          <span className="font-mono">{formatMoney(i.amountDue, i.currency)}</span>
        </span>
      ),
    },
  ];
  const paymentColumns: Column<Payment>[] = [
    {
      key: "date",
      header: "Date",
      render: (p) => <span className="font-mono">{format.day(p.paymentDate)}</span>,
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (p) =>
        typeof p.invoice === "object" && (
          <span className="font-mono text-xs">{p.invoice.number}</span>
        ),
    },
    { key: "method", header: "Method", render: (p) => label(p.method) },
    { key: "ref", header: "Reference", render: (p) => p.transactionReference },
    {
      key: "state",
      header: "",
      render: (p) => p.voidedAt && <StatusBadge status="VOIDED" tone="bad" />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <span className="font-mono">
          <span className="font-mono">{formatMoney(p.amount, p.currency)}</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {client.companyName}
            <StatusBadge status={client.status} />
            <span>{label(client.type)}</span>
          </span>
        }
        actions={
          <>
            {can("proposal:write") && (
              <Link
                href={`/proposals/new?client=${client._id}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 font-medium shadow-card hover:bg-surface-2"
              >
                <FileText className="size-4" aria-hidden />
                New proposal
              </Link>
            )}
            {can("invoice:write") && (
              <Link
                href={`/invoices/new?client=${client._id}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 font-medium shadow-card hover:bg-surface-2"
              >
                <Receipt className="size-4" aria-hidden />
                New invoice
              </Link>
            )}
            {can("client:write") && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can("client:delete") && client.status !== "ARCHIVED" && (
              <Dropdown
                items={[
                  {
                    label: "Archive",
                    icon: Archive,
                    danger: true,
                    onClick: () => setArchiving(true),
                  },
                ]}
              />
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-ink-3">Total projects</p>
          <p className="tabular mt-1 text-2xl font-normal">{client.summary?.totalProjects ?? 0}</p>
          <p className="text-xs text-ink-2">{client.summary?.activeProjects ?? 0} active</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-3">Last interaction</p>
          <p className="mt-1 text-base font-medium">
            <span className="font-mono">{format.date(client.lastInteractionAt) || "None"}</span>
          </p>
        </Card>
        {canFinance && (
          <Card className="sm:col-span-2">
            <p className="text-xs text-ink-3">Billed, received and outstanding</p>
            {client.summary?.financials.length ? (
              <table className="tabular mt-1 w-full font-mono text-[13px]">
                <thead className="text-xs text-ink-3">
                  <tr>
                    <th className="py-0.5 text-left font-medium">Currency</th>
                    <th className="text-right font-medium">Billed</th>
                    <th className="text-right font-medium">Received</th>
                    <th className="text-right font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {client.summary.financials.map((row) => (
                    <tr key={row.currency}>
                      <td className="py-0.5">{row.currency}</td>
                      <td className="text-right">
                        {formatMoney(row.billed, row.currency).split(" ")[1]}
                      </td>
                      <td className="text-right">
                        {formatMoney(row.received, row.currency).split(" ")[1]}
                      </td>
                      <td className="text-right font-medium">
                        {formatMoney(row.outstanding, row.currency).split(" ")[1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 text-ink-2">No invoices issued yet</p>
            )}
          </Card>
        )}
      </div>
      <Card padded={false}>
        <div className="px-2 pt-1">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        {tab === "overview" && (
          <div className="space-y-4 p-4">
            <DetailList
              items={[
                {
                  label: "Email",
                  value: client.email && (
                    <a className="text-accent hover:underline" href={`mailto:${client.email}`}>
                      {client.email}
                    </a>
                  ),
                },
                { label: "Phone", value: client.phone },
                { label: "Website", value: <ExternalLink href={client.website} /> },
                {
                  label: "Location",
                  value: [client.city, client.country].filter(Boolean).join(", "),
                },
                { label: "Timezone", value: client.timezone },
                {
                  label: "Relationship manager",
                  value: <UserChip user={client.relationshipManager} />,
                },
                {
                  label: "Billing address",
                  value: [
                    address?.line1,
                    address?.line2,
                    address?.city,
                    address?.state,
                    address?.postalCode,
                    address?.country,
                  ]
                    .filter(Boolean)
                    .join(", "),
                },
                {
                  label: "Tax ID",
                  value:
                    client.tax?.idNumber &&
                    `${client.tax.idType ? `${client.tax.idType}: ` : ""}${client.tax.idNumber}`,
                },
                {
                  label: "Converted from lead",
                  value: client.sourceLead && (
                    <Link
                      className="text-accent hover:underline"
                      href={`/leads/${client.sourceLead._id}`}
                    >
                      {client.sourceLead.fullName}
                    </Link>
                  ),
                  hidden: !client.sourceLead || !can("lead:read"),
                },
                { label: "Client since", value: format.date(client.createdAt), mono: true },
              ]}
            />
            {client.notes && (
              <div>
                <h3 className="mb-1 text-xs text-ink-3">Notes</h3>
                <p className="whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        )}
        {tab === "projects" && (
          <Related<Project>
            path="/projects"
            params={{ client: id }}
            columns={projectColumns}
            empty={{ icon: FolderKanban, title: "No projects yet" }}
            href={(p) => `/projects/${p._id}`}
          />
        )}
        {tab === "proposals" && (
          <Related<Proposal>
            path="/proposals"
            params={{ client: id }}
            columns={proposalColumns}
            empty={{ icon: FileText, title: "No proposals yet" }}
            href={(p) => `/proposals/${p._id}`}
          />
        )}
        {tab === "invoices" && (
          <Related<Invoice>
            path="/invoices"
            params={{ client: id }}
            columns={invoiceColumns}
            empty={{ icon: Receipt, title: "No invoices yet" }}
            href={(i) => `/invoices/${i._id}`}
          />
        )}
        {tab === "payments" && (
          <Related<Payment>
            path="/payments"
            params={{ client: id }}
            columns={paymentColumns}
            empty={{ icon: Wallet, title: "No payments recorded" }}
          />
        )}
        {tab === "communication" && (
          <ActivityTimeline
            relation={{ client: id }}
            kind="COMMUNICATION"
            timezone={client.timezone}
          />
        )}
        {tab === "activities" && <ActivityTimeline relation={{ client: id }} kind="SYSTEM" />}
        {tab === "documents" && <AttachmentsPanel entityType="CLIENT" entityId={id} />}
      </Card>
      <ClientForm open={editing} onClose={() => setEditing(false)} client={client} />
      <ConfirmationDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        danger
        confirmLabel="Archive"
        title="Archive this client?"
        message="The client will be hidden from lists. Its financial records are kept."
      />
    </>
  );
}
