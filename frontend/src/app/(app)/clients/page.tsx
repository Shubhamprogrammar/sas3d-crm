"use client";

import { Building2, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  UserChip,
  type Column,
} from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { useApiList } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { CLIENT_STATUSES, CLIENT_TYPES, label, toOptions } from "@/lib/constants";
import type { Client } from "@/types";

export default function ClientsPage() {
  const router = useRouter();
  const query = useSearchParams();
  const { can } = useMe();
  const format = useFormat();
  const list = useListState({ status: "", type: "" }, { sortBy: "createdAt", sortOrder: "desc" });
  const { items, meta, isLoading, error, refetch } = useApiList<Client>("/clients", list.params);
  const [formOpen, setFormOpen] = useState(query.get("new") === "1");

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: "Client",
      sortKey: "name",
      render: (c) => (
        <div className="min-w-40">
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-ink-3">{c.companyName}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (c) => label(c.type) },
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <div>
          <p>{c.email}</p>
          <p className="text-xs text-ink-3">{c.phone}</p>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (c) => [c.city, c.country].filter(Boolean).join(", "),
    },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "manager", header: "Manager", render: (c) => <UserChip user={c.relationshipManager} /> },
    {
      key: "last",
      header: "Last interaction",
      sortKey: "lastInteractionAt",
      render: (c) => <span className="whitespace-nowrap">{format.date(c.lastInteractionAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Active relationships and their full history"
        actions={
          can("client:write") && (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setFormOpen(true)}
            >
              New client
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search clients" />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(CLIENT_STATUSES)}
            placeholder="Active and inactive"
          />
          <Select
            aria-label="Type"
            value={list.filters.type}
            onChange={(e) => list.setFilter("type", e.target.value)}
            options={toOptions(CLIENT_TYPES)}
            placeholder="All types"
          />
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(c) => c._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          sort={list.sort}
          onSort={list.toggleSort}
          onRowClick={(c) => router.push(`/clients/${c._id}`)}
          empty={
            <EmptyState
              icon={Building2}
              title={list.hasFilters ? "No clients match these filters" : "No clients yet"}
              description={
                list.hasFilters ? undefined : "Convert a won lead, or add a client directly."
              }
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
      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => router.push(`/clients/${id}`)}
      />
    </>
  );
}
