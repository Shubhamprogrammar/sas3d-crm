"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, DatePicker, Drawer, FormField, Input, Select, Textarea } from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useClientOptions, useTeamOptions } from "@/features/shared/options";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import {
  CURRENCIES,
  PRIORITIES,
  PROJECT_STATUSES,
  SERVICE_CATEGORIES,
  toOptions,
} from "@/lib/constants";
import { api } from "@/services/api";
import type { Project } from "@/types";
import { dayInput } from "@/utils/format";
import { fromMinor, isValidAmount, toMinor } from "@/utils/money";

const schema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  client: z.string(),
  description: z.string(),
  category: z.string(),
  budget: z.string().refine(isValidAmount, "Enter an amount"),
  currency: z.enum(CURRENCIES),
  startDate: z.string(),
  expectedDeliveryDate: z.string(),
  actualCompletionDate: z.string(),
  projectManager: z.string(),
  team: z.array(z.string()),
  priority: z.enum(PRIORITIES),
  status: z.enum(PROJECT_STATUSES),
  githubUrl: z.string(),
  stagingUrl: z.string(),
  productionUrl: z.string(),
  documentationUrl: z.string(),
  internalNotes: z.string(),
});
type Values = z.infer<typeof schema>;

export function ProjectForm({
  open,
  onClose,
  project,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onCreated?: (id: string) => void;
}) {
  const { preferences } = useMe();
  const team = useTeamOptions();
  const clients = useClientOptions();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!open) return;
    reset({
      name: project?.name ?? "",
      client: project?.client._id ?? "",
      description: project?.description ?? "",
      category: project?.category ?? "",
      budget: project ? fromMinor(project.budget) : "",
      currency: (project?.currency ?? preferences.defaultCurrency) as Values["currency"],
      startDate: dayInput(project?.startDate),
      expectedDeliveryDate: dayInput(project?.expectedDeliveryDate),
      actualCompletionDate: dayInput(project?.actualCompletionDate),
      projectManager: project?.projectManager?._id ?? "",
      team: project?.team.map((m) => m._id) ?? [],
      priority: (project?.priority ?? "MEDIUM") as Values["priority"],
      status: (project?.status ?? "NOT_STARTED") as Values["status"],
      githubUrl: project?.githubUrl ?? "",
      stagingUrl: project?.stagingUrl ?? "",
      productionUrl: project?.productionUrl ?? "",
      documentationUrl: project?.documentationUrl ?? "",
      internalNotes: project?.internalNotes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  const save = useApiMutation<Values, { _id: string }>({
    request: ({ client, ...values }) => {
      const body = {
        ...values,
        budget: toMinor(values.budget),
        startDate: values.startDate || null,
        expectedDeliveryDate: values.expectedDeliveryDate || null,
        actualCompletionDate: values.actualCompletionDate || null,
      };
      return project
        ? api.patch(`/projects/${project._id}`, body)
        : api.post("/projects", { ...body, client });
    },
    invalidate: ["/projects", "/dashboard", "/clients", "/activities", "/team"],
    onSuccess: (saved) => {
      onClose();
      if (!project) onCreated?.(saved._id);
    },
    onError: (error) => applyServerErrors(error, setError),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="project-form" loading={save.isPending}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form
        id="project-form"
        onSubmit={handleSubmit((values) => {
          if (!project && !values.client) return setError("client", { message: "Choose a client" });
          save.mutate(values);
        })}
        className="space-y-3"
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Project name"
            required
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            {(f) => <Input {...f} {...register("name")} />}
          </FormField>
          <FormField label="Client" required error={errors.client?.message}>
            {(f) => (
              <Select
                {...f}
                {...register("client")}
                disabled={Boolean(project)}
                options={
                  project ? [{ value: project.client._id, label: project.client.name }] : clients
                }
                placeholder="Choose a client"
              />
            )}
          </FormField>
          <FormField label="Category">
            {(f) => (
              <Select
                {...f}
                {...register("category")}
                options={toOptions(SERVICE_CATEGORIES)}
                placeholder="None"
              />
            )}
          </FormField>
          <FormField label="Status">
            {(f) => <Select {...f} {...register("status")} options={toOptions(PROJECT_STATUSES)} />}
          </FormField>
          <FormField label="Priority">
            {(f) => <Select {...f} {...register("priority")} options={toOptions(PRIORITIES)} />}
          </FormField>
          <FormField label="Budget" error={errors.budget?.message}>
            {(f) => <Input inputMode="decimal" placeholder="0.00" {...f} {...register("budget")} />}
          </FormField>
          <FormField label="Currency">
            {(f) => (
              <Select
                {...f}
                {...register("currency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            )}
          </FormField>
          <FormField label="Start date">
            {(f) => <DatePicker {...f} {...register("startDate")} />}
          </FormField>
          <FormField label="Expected delivery">
            {(f) => <DatePicker {...f} {...register("expectedDeliveryDate")} />}
          </FormField>
          <FormField label="Actual completion" hint="Set automatically when completed">
            {(f) => <DatePicker {...f} {...register("actualCompletionDate")} />}
          </FormField>
          {team.length > 0 && (
            <FormField label="Project manager">
              {(f) => (
                <Select
                  {...f}
                  {...register("projectManager")}
                  options={team.filter((m) =>
                    ["PROJECT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(m.role),
                  )}
                  placeholder="None"
                />
              )}
            </FormField>
          )}
        </div>
        {team.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-[13px] font-medium text-ink-2">Team members</legend>
            <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
              {team.map((member) => (
                <label key={member.value} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    value={member.value}
                    className="size-4 accent-[var(--accent)]"
                    {...register("team")}
                  />
                  {member.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <FormField label="Description">
          {(f) => <Textarea {...f} {...register("description")} />}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="GitHub repository" error={errors.githubUrl?.message}>
            {(f) => <Input type="url" placeholder="https://" {...f} {...register("githubUrl")} />}
          </FormField>
          <FormField label="Staging URL" error={errors.stagingUrl?.message}>
            {(f) => <Input type="url" placeholder="https://" {...f} {...register("stagingUrl")} />}
          </FormField>
          <FormField label="Production URL" error={errors.productionUrl?.message}>
            {(f) => (
              <Input type="url" placeholder="https://" {...f} {...register("productionUrl")} />
            )}
          </FormField>
          <FormField label="Documentation URL" error={errors.documentationUrl?.message}>
            {(f) => (
              <Input type="url" placeholder="https://" {...f} {...register("documentationUrl")} />
            )}
          </FormField>
        </div>
        <FormField label="Internal notes">
          {(f) => <Textarea {...f} {...register("internalNotes")} />}
        </FormField>
      </form>
    </Drawer>
  );
}
