"use client";

import { Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Button,
  ConfirmationDialog,
  DatePicker,
  Dropdown,
  EmptyState,
  FormField,
  Input,
  LoadingSkeleton,
  Modal,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat } from "@/hooks/use-me";
import { MILESTONE_STATUSES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Milestone } from "@/types";
import { dayInput } from "@/utils/format";

const INVALIDATE = ["/milestones", "/projects", "/dashboard", "/activities"];

function MilestoneModal({
  project,
  milestone,
  onClose,
}: {
  project: string;
  milestone: Milestone | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    startDate: dayInput(milestone?.startDate),
    dueDate: dayInput(milestone?.dueDate),
    status: milestone?.status ?? "PENDING",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = useApiMutation({
    request: () => {
      const body = { ...form, startDate: form.startDate || null, dueDate: form.dueDate || null };
      return milestone
        ? api.patch(`/milestones/${milestone._id}`, body)
        : api.post("/milestones", { ...body, project });
    },
    invalidate: INVALIDATE,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={milestone ? "Edit milestone" : "New milestone"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!form.title.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Title" required>
          {(f) => (
            <Input {...f} value={form.title} onChange={(e) => set("title", e.target.value)} />
          )}
        </FormField>
        <FormField label="Description">
          {(f) => (
            <Textarea
              {...f}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Start date">
            {(f) => (
              <DatePicker
                {...f}
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Due date">
            {(f) => (
              <DatePicker
                {...f}
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Status">
            {(f) => (
              <Select
                {...f}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                options={toOptions(MILESTONE_STATUSES)}
              />
            )}
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

export function MilestonesPanel({ project, canManage }: { project: string; canManage: boolean }) {
  const format = useFormat();
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [removing, setRemoving] = useState<Milestone | null>(null);
  const { data, isLoading } = useApiQuery<Milestone[]>("/milestones", { project });
  const remove = useApiMutation<string>({
    request: (id) => api.delete(`/milestones/${id}`),
    invalidate: [...INVALIDATE, "/project-tasks"],
    onSuccess: () => setRemoving(null),
  });
  return (
    <div>
      {canManage && (
        <div className="flex justify-end border-b border-line p-3">
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            Add milestone
          </Button>
        </div>
      )}
      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data?.length ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Milestones count toward project progress"
        />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((milestone) => (
            <li key={milestone._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{milestone.title}</p>
                {milestone.description && (
                  <p className="text-[13px] text-ink-2">{milestone.description}</p>
                )}
                <p className="font-mono text-xs text-ink-3">
                  {[
                    milestone.startDate && `Starts ${format.day(milestone.startDate)}`,
                    milestone.dueDate && `Due ${format.day(milestone.dueDate)}`,
                    milestone.completedAt && `Completed ${format.date(milestone.completedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <StatusBadge status={milestone.status} />
              {canManage && (
                <Dropdown
                  items={[
                    { label: "Edit", icon: Pencil, onClick: () => setEditing(milestone) },
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      onClick: () => setRemoving(milestone),
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <MilestoneModal
          project={project}
          milestone={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmationDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing._id)}
        loading={remove.isPending}
        danger
        confirmLabel="Delete"
        title="Delete this milestone?"
        message="Its tasks are kept but no longer grouped under it."
      />
    </div>
  );
}
