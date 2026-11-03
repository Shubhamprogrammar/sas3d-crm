"use client";

import { useState } from "react";
import { Button, DatePicker, FormField, Input, Modal, Select, Textarea } from "@/components/ui";
import { useTeamOptions } from "@/features/shared/options";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api } from "@/services/api";

const STAGE_PATHS = ["/opportunities", "/leads", "/dashboard", "/activities", "/reports"];

export function useMoveStage(onDone?: () => void) {
  return useApiMutation<{ id: string; to: string; lostReason?: string }>({
    request: ({ id, to, lostReason }) => api.post(`/opportunities/${id}/move`, { to, lostReason }),
    invalidate: STAGE_PATHS,
    toastSuccess: false,
    onSuccess: onDone,
  });
}

export function LostReasonDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading?: boolean;
}) {
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Mark as lost"
      width="max-w-md"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={loading}
            onClick={() => {
              onSubmit(reason.trim());
              setReason("");
            }}
          >
            Mark as lost
          </Button>
        </>
      }
    >
      <FormField label="Lost reason" required hint="Used in the lost-reasons report">
        {(f) => (
          <Textarea
            {...f}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Budget, timing, chose a competitor..."
          />
        )}
      </FormField>
    </Modal>
  );
}

export function ConvertDialog({
  opportunity,
  onClose,
  onConverted,
}: {
  opportunity: { _id: string; title: string } | null;
  onClose: () => void;
  onConverted?: (result: { clientId: string; projectId: string | null }) => void;
}) {
  const { can } = useMe();
  const team = useTeamOptions().filter((member) =>
    ["PROJECT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(member.role),
  );
  const [createProject, setCreateProject] = useState(true);
  const [name, setName] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  const convert = useApiMutation<void, { clientId: string; projectId: string | null }>({
    request: () =>
      api.post(`/opportunities/${opportunity?._id}/convert`, {
        createProject,
        project: createProject
          ? {
              name: name.trim() || opportunity?.title,
              projectManager: projectManager || null,
              startDate: startDate || null,
              expectedDeliveryDate: expectedDeliveryDate || null,
            }
          : undefined,
      }),
    invalidate: [...STAGE_PATHS, "/clients", "/projects"],
    onSuccess: (result) => {
      onClose();
      onConverted?.(result);
    },
  });
  const allowProject = can("project:create");

  return (
    <Modal
      open={Boolean(opportunity)}
      onClose={onClose}
      title="Convert won opportunity"
      description="Links or creates the client without duplicating records."
      footer={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Button variant="primary" loading={convert.isPending} onClick={() => convert.mutate()}>
            Convert
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {allowProject && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={createProject}
              onChange={(e) => setCreateProject(e.target.checked)}
            />
            Also create a project
          </label>
        )}
        {allowProject && createProject && (
          <>
            <FormField label="Project name">
              {(f) => (
                <Input
                  {...f}
                  value={name}
                  placeholder={opportunity?.title}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </FormField>
            {team.length > 0 && (
              <FormField label="Project manager">
                {(f) => (
                  <Select
                    {...f}
                    value={projectManager}
                    onChange={(e) => setProjectManager(e.target.value)}
                    options={team}
                    placeholder="Assign later"
                  />
                )}
              </FormField>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Start date">
                {(f) => (
                  <DatePicker
                    {...f}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Expected delivery">
                {(f) => (
                  <DatePicker
                    {...f}
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  />
                )}
              </FormField>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
