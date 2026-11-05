"use client";

import { FolderKanban, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  Select,
  StatusBadge,
  UserChip,
  type Column,
} from "@/components/ui";
import { ProjectForm } from "@/features/projects/project-form";
import { useApiList } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { PRIORITIES, PROJECT_STATUSES, toOptions } from "@/lib/constants";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const router = useRouter();
  const query = useSearchParams();
  const { can } = useMe();
  const format = useFormat();
  const list = useListState(
    { status: "", priority: "" },
    { sortBy: "createdAt", sortOrder: "desc" },
  );
  const { items, meta, isLoading, error, refetch } = useApiList<Project>("/projects", list.params);
  const [formOpen, setFormOpen] = useState(query.get("new") === "1");
  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      sortKey: "name",
      render: (p) => (
        <div className="min-w-44">
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-ink-3">
            <span className="font-mono">{p.code}</span> · {p.client?.name}
          </p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "priority",
      header: "Priority",
      sortKey: "priority",
      render: (p) => <StatusBadge status={p.priority} />,
    },
    {
      key: "progress",
      header: "Progress",
      render: (p) => (
        <div className="w-32">
          <ProgressBar value={p.progress} />
        </div>
      ),
    },
    { key: "manager", header: "Manager", render: (p) => <UserChip user={p.projectManager} /> },
    {
      key: "due",
      header: "Expected delivery",
      sortKey: "expectedDeliveryDate",
      render: (p) => (
        <span className="whitespace-nowrap">{format.day(p.expectedDeliveryDate)}</span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          can("project:create") && (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setFormOpen(true)}
            >
              New project
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search name or code"
          />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(PROJECT_STATUSES)}
            placeholder="All statuses"
          />
          <Select
            aria-label="Priority"
            value={list.filters.priority}
            onChange={(e) => list.setFilter("priority", e.target.value)}
            options={toOptions(PRIORITIES)}
            placeholder="All priorities"
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
          onRowClick={(p) => router.push(`/projects/${p._id}`)}
          empty={
            <EmptyState
              icon={FolderKanban}
              title={list.hasFilters ? "No projects match these filters" : "No projects yet"}
              description={
                list.hasFilters
                  ? undefined
                  : "Convert a won opportunity, or create a project directly."
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
      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />
    </>
  );
}
