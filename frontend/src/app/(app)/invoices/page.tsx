"use client";

import { Plus, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  buttonClass,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  type Column,
} from "@/components/ui";
import { useApiList } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { CURRENCIES, INVOICE_STATUSES, label, PAYMENT_METHODS, toOptions } from "@/lib/constants";
import type { Invoice, Payment } from "@/types";
import { formatMoney } from "@/utils/money";

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

function InvoicesTab() {
  const router = useRouter();
  const format = useFormat();
  const list = useListState(
    { status: "", currency: "" },
    { sortBy: "createdAt", sortOrder: "desc" },
  );
  const { items, meta, isLoading, error, refetch } = useApiList<Invoice>("/invoices", list.params);
  const columns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Number",
      sortKey: "number",
      render: (i) => (
        <span className="whitespace-nowrap font-mono text-xs font-medium">{i.number}</span>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (i) => (
        <div className="min-w-36">
          {i.client?.name}
          <p className="font-mono text-xs text-ink-3">{i.project?.code}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
    {
      key: "issue",
      header: "Issued",
      sortKey: "issueDate",
      render: (i) => (
        <span className="whitespace-nowrap">
          <span className="font-mono">{format.day(i.issueDate)}</span>
        </span>
      ),
    },
    {
      key: "due",
      header: "Due",
      sortKey: "dueDate",
      render: (i) => (
        <span className="whitespace-nowrap">
          <span className="font-mono">{format.day(i.dueDate)}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortKey: "total",
      align: "right",
      render: (i) => (
        <span className="whitespace-nowrap">
          <span className="font-mono">{formatMoney(i.total, i.currency)}</span>
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (i) => (
        <span className="whitespace-nowrap font-medium">
          <span className="font-mono">{formatMoney(i.amountDue, i.currency)}</span>
        </span>
      ),
    },
  ];
  return (
    <>
      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_180px_140px]">
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search number or client"
        />
        <Select
          aria-label="Status"
          value={list.filters.status}
          onChange={(e) => list.setFilter("status", e.target.value)}
          options={toOptions(INVOICE_STATUSES)}
          placeholder="All statuses"
        />
        <Select
          aria-label="Currency"
          value={list.filters.currency}
          onChange={(e) => list.setFilter("currency", e.target.value)}
          options={CURRENCY_OPTIONS}
          placeholder="All currencies"
        />
      </div>
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(i) => i._id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        sort={list.sort}
        onSort={list.toggleSort}
        onRowClick={(i) => router.push(`/invoices/${i._id}`)}
        empty={
          <EmptyState
            icon={Receipt}
            title={list.hasFilters ? "No invoices match these filters" : "No invoices yet"}
          />
        }
      />
      {meta && (
        <Pagination
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          onChange={list.setPage}
        />
      )}
    </>
  );
}

function PaymentsTab() {
  const router = useRouter();
  const format = useFormat();
  const list = useListState({ method: "", currency: "" });
  const { items, meta, isLoading, error, refetch } = useApiList<Payment>("/payments", list.params);
  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Date",
      render: (p) => (
        <span className="whitespace-nowrap">
          <span className="font-mono">{format.day(p.paymentDate)}</span>
        </span>
      ),
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (p) =>
        typeof p.invoice === "object" && (
          <span className="font-mono text-xs font-medium">{p.invoice.number}</span>
        ),
    },
    {
      key: "client",
      header: "Client",
      render: (p) => typeof p.client === "object" && p.client.name,
    },
    { key: "method", header: "Method", render: (p) => label(p.method) },
    { key: "reference", header: "Reference", render: (p) => p.transactionReference },
    { key: "by", header: "Recorded by", render: (p) => p.recordedBy?.name },
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
        <span className={`whitespace-nowrap ${p.voidedAt ? "text-ink-3 line-through" : ""}`}>
          <span className="font-mono">{formatMoney(p.amount, p.currency)}</span>
        </span>
      ),
    },
  ];
  return (
    <>
      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_180px_140px]">
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search transaction reference"
        />
        <Select
          aria-label="Method"
          value={list.filters.method}
          onChange={(e) => list.setFilter("method", e.target.value)}
          options={toOptions(PAYMENT_METHODS)}
          placeholder="All methods"
        />
        <Select
          aria-label="Currency"
          value={list.filters.currency}
          onChange={(e) => list.setFilter("currency", e.target.value)}
          options={CURRENCY_OPTIONS}
          placeholder="All currencies"
        />
      </div>
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(p) => p._id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(p) =>
          typeof p.invoice === "object" && router.push(`/invoices/${p.invoice._id}`)
        }
        empty={
          <EmptyState
            icon={Wallet}
            title="No payments recorded"
            description="Open an issued invoice to record a payment"
          />
        }
      />
      {meta && (
        <Pagination
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          onChange={list.setPage}
        />
      )}
    </>
  );
}

export default function InvoicesPage() {
  const { can } = useMe();
  const [tab, setTab] = useState("invoices");
  return (
    <>
      <PageHeader
        title="Invoices and payments"
        actions={
          can("invoice:write") && (
            <Link href="/invoices/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden />
              New invoice
            </Link>
          )
        }
      />
      <Card padded={false}>
        <div className="px-2 pt-1">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: "invoices", label: "Invoices" },
              { key: "payments", label: "Payments" },
            ]}
          />
        </div>
        {tab === "invoices" ? <InvoicesTab /> : <PaymentsTab />}
      </Card>
    </>
  );
}
