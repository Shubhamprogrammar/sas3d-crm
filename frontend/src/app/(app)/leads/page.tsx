"use client";

import { Archive, ArchiveRestore, Download, Pencil, Plus, Upload, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  UserChip,
  useToast,
  type Column,
} from "@/components/ui";
import { LeadForm } from "@/features/leads/lead-form";
import { useServiceOptions, useTeamOptions } from "@/features/shared/options";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { LEAD_SOURCES, PIPELINE_STAGES, PRIORITIES, label, toOptions } from "@/lib/constants";
import { api, downloadFile } from "@/services/api";
import type { Lead } from "@/types";
import { formatMoney } from "@/utils/money";

interface ImportResult {
  created: number;
  duplicates: number;
  failed: number;
  errors: { row: number; message: string }[];
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = useApiMutation<File, ImportResult>({
    request: (csv) => {
      const form = new FormData();
      form.append("file", csv);
      return api.upload("/leads/import", form);
    },
    invalidate: ["/leads", "/opportunities", "/dashboard"],
    toastSuccess: false,
    onSuccess: setResult,
  });
  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Import leads from CSV"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!file}
              loading={run.isPending}
              onClick={() => file && run.mutate(file)}
            >
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2">
          <p>
            <strong>{result.created}</strong> created, <strong>{result.duplicates}</strong> skipped
            as duplicates, <strong>{result.failed}</strong> failed.
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg bg-surface-2 p-3 text-[13px]">
              {result.errors.map((error) => (
                <li key={error.row}>
                  Row {error.row}: {error.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-ink-2">
            The first row must hold column names. Recognised columns: Full Name (required), Company,
            Email, Phone, WhatsApp, Country, State, City, Timezone, Website, LinkedIn, Source,
            Priority, Description, Requirements.
          </p>
          <Input
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="pt-1.5"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-ink-3">
            Leads with an email or phone that already exists are skipped.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const query = useSearchParams();
  const { can } = useMe();
  const format = useFormat();
  const toast = useToast();
  const team = useTeamOptions();
  const { options: services } = useServiceOptions(false);
  const list = useListState(
    {
      status: "",
      source: "",
      priority: "",
      service: "",
      assignedTo: "",
      country: "",
      archived: "",
    },
    { sortBy: "createdAt", sortOrder: "desc" },
  );
  const { items, meta, isLoading, error, refetch } = useApiList<Lead>("/leads", list.params);

  const [formOpen, setFormOpen] = useState(query.get("new") === "1");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [archiving, setArchiving] = useState<Lead | null>(null);
  const [importing, setImporting] = useState(false);

  const archive = useApiMutation<string>({
    request: (id) => api.delete(`/leads/${id}`),
    invalidate: ["/leads", "/opportunities", "/dashboard"],
    onSuccess: () => setArchiving(null),
  });
  const restore = useApiMutation<string>({
    request: (id) => api.post(`/leads/${id}/restore`),
    invalidate: ["/leads", "/opportunities", "/dashboard"],
  });

  const columns: Column<Lead>[] = [
    {
      key: "name",
      header: "Lead",
      sortKey: "fullName",
      render: (l) => (
        <div className="min-w-40">
          <p className="font-medium">{l.fullName}</p>
          <p className="text-xs text-ink-3">{l.companyName}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (l) => (
        <div className="max-w-44">
          <p className="truncate" title={l.email}>
            {l.email}
          </p>
          <p className="truncate text-xs text-ink-3">{l.phone}</p>
        </div>
      ),
    },
    {
      key: "origin",
      header: "Location and source",
      render: (l) => (
        <div className="max-w-36">
          <p className="truncate" title={l.country}>
            {l.country}
          </p>
          <p className="text-xs text-ink-3">{label(l.source)}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      key: "priority",
      header: "Priority",
      sortKey: "priority",
      render: (l) => <StatusBadge status={l.priority} />,
    },
    {
      key: "budget",
      header: "Budget",
      sortKey: "estimatedBudget",
      align: "right",
      render: (l) => (l.estimatedBudget ? formatMoney(l.estimatedBudget, l.budgetCurrency) : ""),
    },
    { key: "assigned", header: "Assigned", render: (l) => <UserChip user={l.assignedTo} /> },
    {
      key: "followUp",
      header: "Next follow-up",
      sortKey: "nextFollowUpAt",
      render: (l) => <span className="whitespace-nowrap">{format.date(l.nextFollowUpAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (l) =>
        can("lead:write") && (
          <Dropdown
            items={
              l.archivedAt
                ? [{ label: "Restore", icon: ArchiveRestore, onClick: () => restore.mutate(l._id) }]
                : [
                    { label: "Edit", icon: Pencil, onClick: () => setEditing(l) },
                    {
                      label: "Archive",
                      icon: Archive,
                      danger: true,
                      onClick: () => setArchiving(l),
                    },
                  ]
            }
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every potential client, from first contact to conversion."
        actions={
          <>
            {can("lead:import") && (
              <Button icon={<Upload className="size-4" />} onClick={() => setImporting(true)}>
                Import
              </Button>
            )}
            {can("lead:export") && (
              <Button
                icon={<Download className="size-4" />}
                onClick={() =>
                  downloadFile("/leads/export", "leads.csv", list.params).catch((e: Error) =>
                    toast.error(e.message),
                  )
                }
              >
                Export
              </Button>
            )}
            {can("lead:write") && (
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setFormOpen(true)}
              >
                New lead
              </Button>
            )}
          </>
        }
      />
      <Card padded={false}>
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 sm:grid-cols-3 lg:grid-cols-6">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search leads"
            className="col-span-2 sm:col-span-3 lg:col-span-2"
          />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(PIPELINE_STAGES)}
            placeholder="All statuses"
          />
          <Select
            aria-label="Source"
            value={list.filters.source}
            onChange={(e) => list.setFilter("source", e.target.value)}
            options={toOptions(LEAD_SOURCES)}
            placeholder="All sources"
          />
          <Select
            aria-label="Service"
            value={list.filters.service}
            onChange={(e) => list.setFilter("service", e.target.value)}
            options={services}
            placeholder="All services"
          />
          <Select
            aria-label="Priority"
            value={list.filters.priority}
            onChange={(e) => list.setFilter("priority", e.target.value)}
            options={toOptions(PRIORITIES)}
            placeholder="All priorities"
          />
          <Input
            aria-label="Country"
            placeholder="Country"
            value={list.filters.country}
            onChange={(e) => list.setFilter("country", e.target.value)}
          />
          {team.length > 0 && (
            <Select
              aria-label="Assigned to"
              value={list.filters.assignedTo}
              onChange={(e) => list.setFilter("assignedTo", e.target.value)}
              options={team}
              placeholder="Anyone"
            />
          )}
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={list.filters.archived === "true"}
              onChange={(e) => list.setFilter("archived", e.target.checked ? "true" : "")}
            />
            Show archived
          </label>
          {list.hasFilters && (
            <Button variant="ghost" onClick={list.clear}>
              Clear filters
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(l) => l._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          sort={list.sort}
          onSort={list.toggleSort}
          onRowClick={(l) => router.push(`/leads/${l._id}`)}
          empty={
            list.hasFilters ? (
              <EmptyState
                icon={Users}
                title="No leads match these filters"
                action={<Button onClick={list.clear}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No leads yet"
                description="Add your first lead or import a CSV to fill the pipeline."
                action={
                  can("lead:write") ? (
                    <Button variant="primary" onClick={() => setFormOpen(true)}>
                      New lead
                    </Button>
                  ) : undefined
                }
              />
            )
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
      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => router.push(`/leads/${id}`)}
      />
      <LeadForm open={Boolean(editing)} onClose={() => setEditing(null)} lead={editing} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
      <ConfirmationDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archiving && archive.mutate(archiving._id)}
        loading={archive.isPending}
        danger
        confirmLabel="Archive"
        title="Archive this lead?"
        message={`${archiving?.fullName} and its pipeline card will be hidden. You can restore it later.`}
      />
    </>
  );
}
