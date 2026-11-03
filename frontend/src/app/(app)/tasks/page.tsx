"use client";

import { CalendarDays, CheckSquare, List, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  Dropdown,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  UserChip,
  type Column,
} from "@/components/ui";
import { useTeamOptions } from "@/features/shared/options";
import { TaskCalendar } from "@/features/tasks/calendar";
import { TaskForm } from "@/features/tasks/task-form";
import { useApiList, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { PRIORITIES, TASK_STATUSES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Task } from "@/types";

const INVALIDATE = ["/tasks", "/dashboard", "/activities", "/team"];

export default function TasksPage() {
  const query = useSearchParams();
  const { can } = useMe();
  const format = useFormat();
  const team = useTeamOptions();
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const list = useListState(
    { view: "", status: "", priority: "", assignedTo: "" },
    { sortBy: "dueAt", sortOrder: "asc" },
  );
  const { items, meta, isLoading, error, refetch } = useApiList<Task>(
    mode === "list" ? "/tasks" : null,
    list.params,
  );

  const [creating, setCreating] = useState(query.get("new") === "1");
  const [editing, setEditing] = useState<Task | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);

  // Notifications and search link here with ?task=<id> to open that task directly.
  const linkedId = query.get("task");
  const { data: linked } = useApiQuery<Task>(linkedId ? `/tasks/${linkedId}` : null);
  useEffect(() => {
    if (linked) setEditing(linked);
  }, [linked]);

  const toggle = useApiMutation<Task>({
    request: (task) =>
      api.patch(`/tasks/${task._id}`, {
        status: task.status === "COMPLETED" ? "TODO" : "COMPLETED",
      }),
    invalidate: INVALIDATE,
    toastSuccess: false,
  });
  const remove = useApiMutation<string>({
    request: (id) => api.delete(`/tasks/${id}`),
    invalidate: INVALIDATE,
    onSuccess: () => setRemoving(null),
  });

  const now = Date.now();
  const columns: Column<Task>[] = [
    {
      key: "done",
      header: "",
      render: (t) => (
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          aria-label={`Mark ${t.title} complete`}
          checked={t.status === "COMPLETED"}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle.mutate(t)}
        />
      ),
    },
    {
      key: "title",
      header: "Task",
      sortKey: "title",
      render: (t) => (
        <div className="min-w-48">
          <p className={`font-medium ${t.status === "COMPLETED" ? "text-ink-3 line-through" : ""}`}>
            {t.title}
          </p>
          <p className="text-xs text-ink-3">
            {t.lead?.fullName ?? t.client?.name ?? t.project?.name}
          </p>
        </div>
      ),
    },
    {
      key: "due",
      header: "Due",
      sortKey: "dueAt",
      render: (t) => {
        const overdue =
          t.dueAt &&
          new Date(t.dueAt).getTime() < now &&
          ["TODO", "IN_PROGRESS"].includes(t.status);
        return (
          <span className={`whitespace-nowrap ${overdue ? "font-medium text-bad" : ""}`}>
            {t.hasDueTime ? format.dateTime(t.dueAt) : format.date(t.dueAt)}
            {overdue ? " (overdue)" : ""}
          </span>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      sortKey: "priority",
      render: (t) => <StatusBadge status={t.priority} />,
    },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    { key: "assigned", header: "Assigned", render: (t) => <UserChip user={t.assignedTo} /> },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <Dropdown
          items={[
            {
              label: "Edit",
              icon: Pencil,
              onClick: () => setEditing(t),
              hidden: !can("task:write"),
            },
            {
              label: "Delete",
              icon: Trash2,
              danger: true,
              onClick: () => setRemoving(t),
              hidden: !can("task:delete"),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tasks and follow-ups"
        actions={
          <>
            <div
              className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5"
              role="group"
              aria-label="View"
            >
              <Button
                variant={mode === "list" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "list"}
                icon={<List className="size-4" />}
                onClick={() => setMode("list")}
              >
                List
              </Button>
              <Button
                variant={mode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "calendar"}
                icon={<CalendarDays className="size-4" />}
                onClick={() => setMode("calendar")}
              >
                Calendar
              </Button>
            </div>
            {can("task:write") && (
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setCreating(true)}
              >
                New task
              </Button>
            )}
          </>
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search tasks" />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(TASK_STATUSES)}
            placeholder="All statuses"
          />
          <Select
            aria-label="Priority"
            value={list.filters.priority}
            onChange={(e) => list.setFilter("priority", e.target.value)}
            options={toOptions(PRIORITIES)}
            placeholder="All priorities"
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
        </div>
        {mode === "list" ? (
          <>
            <div className="px-2">
              <Tabs
                active={list.filters.view}
                onChange={(view) => list.setFilter("view", view)}
                tabs={[
                  { key: "", label: "All" },
                  { key: "today", label: "Today" },
                  { key: "upcoming", label: "Upcoming" },
                  { key: "overdue", label: "Overdue" },
                ]}
              />
            </div>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(t) => t._id}
              loading={isLoading}
              error={error}
              onRetry={refetch}
              sort={list.sort}
              onSort={list.toggleSort}
              onRowClick={can("task:write") ? setEditing : undefined}
              empty={
                <EmptyState
                  icon={CheckSquare}
                  title={list.filters.view === "overdue" ? "Nothing is overdue" : "No tasks here"}
                  action={
                    can("task:write") ? (
                      <Button onClick={() => setCreating(true)}>New task</Button>
                    ) : undefined
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
          </>
        ) : (
          <div className="border-t border-line">
            <TaskCalendar
              params={{
                ...(list.filters.priority ? { priority: list.filters.priority } : {}),
                ...(list.filters.status ? { status: list.filters.status } : {}),
                ...(list.filters.assignedTo ? { assignedTo: list.filters.assignedTo } : {}),
              }}
              onSelect={setEditing}
            />
          </div>
        )}
      </Card>
      <TaskForm open={creating} onClose={() => setCreating(false)} />
      <TaskForm open={Boolean(editing)} onClose={() => setEditing(null)} task={editing} />
      <ConfirmationDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing._id)}
        loading={remove.isPending}
        danger
        confirmLabel="Delete"
        title="Delete this task?"
        message={removing?.title}
      />
    </>
  );
}
