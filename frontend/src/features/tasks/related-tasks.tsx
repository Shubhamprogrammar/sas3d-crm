"use client";

import { CheckSquare, Plus } from "lucide-react";
import { useState } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
  UserChip,
} from "@/components/ui";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { Task } from "@/types";
import { TaskForm } from "./task-form";

export function RelatedTasks({
  relation,
  defaultTitle,
}: {
  relation: { lead?: string; client?: string; project?: string };
  defaultTitle?: string;
}) {
  const { can } = useMe();
  const format = useFormat();
  const [creating, setCreating] = useState(false);
  const { items, isLoading, error, refetch } = useApiList<Task>("/tasks", {
    ...relation,
    limit: 50,
  });
  const toggle = useApiMutation<Task>({
    request: (task) =>
      api.patch(`/tasks/${task._id}`, {
        status: task.status === "COMPLETED" ? "TODO" : "COMPLETED",
      }),
    invalidate: ["/tasks", "/dashboard", "/activities"],
    toastSuccess: false,
  });
  return (
    <div>
      {can("task:write") && (
        <div className="flex justify-end border-b border-line p-3">
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Add follow-up task
          </Button>
        </div>
      )}
      {isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !items.length ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((task) => (
            <li key={task._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                aria-label={`Mark ${task.title} complete`}
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
                {task.hasDueTime ? format.dateTime(task.dueAt) : format.date(task.dueAt)}
              </span>
              <StatusBadge status={task.priority} />
            </li>
          ))}
        </ul>
      )}
      <TaskForm
        open={creating}
        onClose={() => setCreating(false)}
        defaults={{ ...relation, title: defaultTitle }}
      />
    </div>
  );
}
