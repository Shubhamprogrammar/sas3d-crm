"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, DatePicker, Drawer, FormField, Input, Select, Textarea } from "@/components/ui";
import { useClientOptions, useProjectOptions, useTeamOptions } from "@/features/shared/options";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { PRIORITIES, TASK_STATUSES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Task } from "@/types";
import { localInput, localToIso } from "@/utils/format";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string(),
  assignedTo: z.string(),
  priority: z.enum(PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueDate: z.string(),
  dueTime: z.string(),
  client: z.string(),
  project: z.string(),
});
type Values = z.infer<typeof schema>;

function toValues(task: Task | null, meId: string): Values {
  const local = localInput(task?.dueAt);
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignedTo: task ? (task.assignedTo?._id ?? "") : meId,
    priority: (task?.priority ?? "MEDIUM") as Values["priority"],
    status: (task?.status ?? "TODO") as Values["status"],
    dueDate: local.slice(0, 10),
    dueTime: task?.hasDueTime ? local.slice(11, 16) : "",
    client: task?.client?._id ?? "",
    project: task?.project?._id ?? "",
  };
}

/** A date with no time means due by the end of that day. */
function toDue(values: Values) {
  if (!values.dueDate) return { dueAt: null, hasDueTime: false };
  return {
    dueAt: localToIso(`${values.dueDate}T${values.dueTime || "23:59"}`),
    hasDueTime: Boolean(values.dueTime),
  };
}

export function TaskForm({
  open,
  onClose,
  task,
  defaults = {},
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaults?: { lead?: string; client?: string; project?: string; title?: string };
}) {
  const { me } = useMe();
  const team = useTeamOptions();
  const clients = useClientOptions();
  const projects = useProjectOptions();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open)
      reset({
        ...toValues(task ?? null, me?.user._id ?? ""),
        ...(task
          ? {}
          : {
              client: defaults.client ?? "",
              project: defaults.project ?? "",
              title: defaults.title ?? "",
            }),
      });
    // Only re-seed when the drawer opens or the target task changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const save = useApiMutation<Values>({
    request: (values) => {
      const { title, description, assignedTo, priority, status, client, project } = values;
      const body = {
        title,
        description,
        assignedTo,
        priority,
        status,
        client,
        project,
        ...toDue(values),
        ...(defaults.lead && !task ? { lead: defaults.lead } : {}),
      };
      return task ? api.patch(`/tasks/${task._id}`, body) : api.post("/tasks", body);
    },
    invalidate: ["/tasks", "/dashboard", "/team"],
    onSuccess: onClose,
    onError: (error) => applyServerErrors(error, setError),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form" loading={save.isPending}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form
        id="task-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="space-y-3"
        noValidate
      >
        <FormField label="Title" required error={errors.title?.message}>
          {(f) => <Input {...f} {...register("title")} />}
        </FormField>
        <FormField label="Description">
          {(f) => <Textarea {...f} {...register("description")} />}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Due date">
            {(f) => <DatePicker {...f} {...register("dueDate")} />}
          </FormField>
          <FormField label="Due time" hint="Leave empty for end of day">
            {(f) => <Input type="time" {...f} {...register("dueTime")} />}
          </FormField>
          <FormField label="Priority">
            {(f) => <Select {...f} {...register("priority")} options={toOptions(PRIORITIES)} />}
          </FormField>
          <FormField label="Status">
            {(f) => <Select {...f} {...register("status")} options={toOptions(TASK_STATUSES)} />}
          </FormField>
        </div>
        {team.length > 0 && (
          <FormField label="Assigned to">
            {(f) => (
              <Select {...f} {...register("assignedTo")} options={team} placeholder="Unassigned" />
            )}
          </FormField>
        )}
        {clients.length > 0 && (
          <FormField label="Related client">
            {(f) => <Select {...f} {...register("client")} options={clients} placeholder="None" />}
          </FormField>
        )}
        {projects.length > 0 && (
          <FormField label="Related project">
            {(f) => (
              <Select {...f} {...register("project")} options={projects} placeholder="None" />
            )}
          </FormField>
        )}
      </form>
    </Drawer>
  );
}
