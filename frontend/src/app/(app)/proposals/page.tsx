"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  type Column,
} from "@/components/ui";
import { useApiList } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { PROPOSAL_STATUSES, toOptions } from "@/lib/constants";
import type { Proposal } from "@/types";
import { formatMoney } from "@/utils/money";

export default function ProposalsPage() {
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const list = useListState({ status: "" }, { sortBy: "createdAt", sortOrder: "desc" });
  const { items, meta, isLoading, error, refetch } = useApiList<Proposal>(
    "/proposals",
    list.params,
  );

  const columns: Column<Proposal>[] = [
    {
      key: "number",
      header: "Number",
      sortKey: "number",
      render: (p) => (
        <span className="whitespace-nowrap font-mono text-xs font-medium">{p.number}</span>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (p) => (
        <div className="min-w-48">
          {p.title}
          {p.revision > 1 && <span className="ml-1.5 text-xs text-ink-3">rev {p.revision}</span>}
        </div>
      ),
    },
    { key: "for", header: "For", render: (p) => p.client?.name ?? p.lead?.fullName },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "valid",
      header: "Valid until",
      sortKey: "validUntil",
      render: (p) => (
        <span className="whitespace-nowrap">
          <span className="font-mono">{format.day(p.validUntil)}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortKey: "total",
      align: "right",
      render: (p) => (
        <span className="font-mono">
          <span className="font-mono">{formatMoney(p.total, p.currency)}</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proposals"
        actions={
          can("proposal:write") && (
            <Link href="/proposals/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden />
              New proposal
            </Link>
          )
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search number or title"
          />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(PROPOSAL_STATUSES)}
            placeholder="All statuses"
          />
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(p) => p._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          sort={list.sort}
          onSort={list.toggleSort}
          onRowClick={(p) => router.push(`/proposals/${p._id}`)}
          empty={
            <EmptyState
              icon={FileText}
              title={list.hasFilters ? "No proposals match these filters" : "No proposals yet"}
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
      </Card>
    </>
  );
}
