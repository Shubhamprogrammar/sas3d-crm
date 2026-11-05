"use client";

import { CornerDownRight, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
  UserChip,
} from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { PRIORITIES, TASK_STATUSES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Milestone, Project, ProjectTask } from "@/types";
import { dayInput } from "@/utils/format";

const INVALIDATE = ["/project-tasks", "/projects", "/dashboard", "/activities"];

function TaskModal({
  project,
  task,
  parent,
  canManage,
  onClose,
}: {
  project: Project;
  task: ProjectTask | null;
  parent: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const { data: milestones } = useApiQuery<Milestone[]>("/milestones", { project: project._id });
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignedTo: task?.assignedTo?._id ?? "",
    priority: task?.priority ?? "MEDIUM",
    dueDate: dayInput(task?.dueDate),
    status: task?.status ?? "TODO",
    milestone: task?.milestone ?? "",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const members = [...(project.projectManager ? [project.projectManager] : []), ...project.team]
    .filter((m, i, all) => all.findIndex((x) => x._id === m._id) === i)
    .map((m) => ({ value: m._id, label: m.name }));
  const save = useApiMutation({
    request: () => {
      // Assignees below manager level may only report status and notes; the API enforces this too.
      if (task && !canManage)
        return api.patch(`/project-tasks/${task._id}`, {
          status: form.status,
          description: form.description,
        });
      const body = {
        ...form,
        assignedTo: form.assignedTo || null,
        milestone: form.milestone || null,
        dueDate: form.dueDate || null,
      };
      return task
        ? api.patch(`/project-tasks/${task._id}`, body)
        : api.post("/project-tasks", { ...body, project: project._id, parentTask: parent });
    },
    invalidate: INVALIDATE,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Edit task" : parent ? "New subtask" : "New task"}
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
            <Input
              {...f}
              disabled={!canManage}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Notes">
          {(f) => (
            <Textarea
              {...f}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Status">
            {(f) => (
              <Select
                {...f}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                options={toOptions(TASK_STATUSES)}
              />
            )}
          </FormField>
          <FormField label="Priority">
            {(f) => (
              <Select
                {...f}
                disabled={!canManage}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                options={toOptions(PRIORITIES)}
              />
            )}
          </FormField>
          <FormField label="Assigned to">
            {(f) => (
              <Select
                {...f}
                disabled={!canManage}
                value={form.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
                options={members}
                placeholder="Unassigned"
              />
            )}
          </FormField>
          <FormField label="Due date">
            {(f) => (
              <DatePicker
                {...f}
                disabled={!canManage}
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Milestone" className="sm:col-span-2">
            {(f) => (
              <Select
                {...f}
                disabled={!canManage}
                value={form.milestone}
                onChange={(e) => set("milestone", e.target.value)}
                options={(milestones ?? []).map((m) => ({ value: m._id, label: m.title }))}
                placeholder="None"
              />
            )}
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

export function ProjectTasksPanel({
  project,
  canManage,
}: {
  project: Project;
  canManage: boolean;
}) {
  const { me } = useMe();
  const format = useFormat();
  const [editing, setEditing] = useState<{
    task: ProjectTask | null;
    parent: string | null;
  } | null>(null);
  const [removing, setRemoving] = useState<ProjectTask | null>(null);
  const { data, isLoading } = useApiQuery<ProjectTask[]>("/project-tasks", {
    project: project._id,
  });
  const toggle = useApiMutation<ProjectTask>({
    request: (task) =>
      api.patch(`/project-tasks/${task._id}`, {
        status: task.status === "COMPLETED" ? "TODO" : "COMPLETED",
      }),
    invalidate: INVALIDATE,
    toastSuccess: false,
  });
  const remove = useApiMutation<string>({
    request: (id) => api.delete(`/project-tasks/${id}`),
    invalidate: INVALIDATE,
    onSuccess: () => setRemoving(null),
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    return all
      .filter((t) => !t.parentTask)
      .flatMap((parent) => [parent, ...all.filter((t) => t.parentTask === parent._id)]);
  }, [data]);

  const editable = (task: ProjectTask) => canManage || task.assignedTo?._id === me?.user._id;

  return (
    <div>
      {canManage && (
        <div className="flex justify-end border-b border-line p-3">
          <Button
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing({ task: null, parent: null })}
          >
            Add task
          </Button>
        </div>
      )}
      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !rows.length ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Tasks and subtasks count toward project progress"
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((task) => (
            <li
              key={task._id}
              className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${task.parentTask ? "pl-8" : ""}`}
            >
              {task.parentTask && <CornerDownRight className="size-3.5 text-ink-3" aria-hidden />}
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                aria-label={`Mark ${task.title} complete`}
                disabled={!editable(task)}
                checked={task.status === "COMPLETED"}
                onChange={() => toggle.mutate(task)}
              />
              <span
                className={`min-w-0 flex-1 ${task.status === "COMPLETED" ? "text-ink-3 line-through" : ""}`}
              >
                {task.title}
              </span>
              <UserChip user={task.assignedTo} />
              <span className="tabular text-xs text-ink-2">
                <span className="font-mono">{format.day(task.dueDate)}</span>
              </span>
              <StatusBadge status={task.status} />
              {editable(task) && (
                <Dropdown
                  items={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => setEditing({ task, parent: task.parentTask }),
                    },
                    {
                      label: "Add subtask",
                      icon: Plus,
                      hidden: !canManage || Boolean(task.parentTask),
                      onClick: () => setEditing({ task: null, parent: task._id }),
                    },
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      hidden: !canManage,
                      onClick: () => setRemoving(task),
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TaskModal
          project={project}
          task={editing.task}
          parent={editing.parent}
          canManage={canManage}
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
        title="Delete this task?"
        message="Its subtasks are deleted too."
      />
    </div>
  );
}
