"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity as ActivityIcon,
  Mail,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  Phone,
  Plus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  DatePicker,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingSkeleton,
  Modal,
  Pagination,
  Select,
  Textarea,
} from "@/components/ui";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { COMMUNICATION_TYPES, label, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Activity } from "@/types";
import { localInput, localToIso } from "@/utils/format";

const ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  PHONE_CALL: Phone,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  LINKEDIN_MESSAGE: MessagesSquare,
  INTERNAL_NOTE: NotebookPen,
};

const schema = z.object({
  commType: z.enum(COMMUNICATION_TYPES),
  subject: z.string().trim().min(1, "Subject is required"),
  description: z.string(),
  occurredAt: z.string().min(1, "Date and time are required"),
  nextFollowUpAt: z.string(),
});

function LogModal({
  open,
  onClose,
  relation,
}: {
  open: boolean;
  onClose: () => void;
  relation: { lead?: string; client?: string };
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      commType: "EMAIL" as const,
      subject: "",
      description: "",
      occurredAt: localInput(new Date().toISOString()),
      nextFollowUpAt: "",
    },
  });
  const save = useApiMutation<z.infer<typeof schema>>({
    request: (values) =>
      api.post("/activities", {
        ...relation,
        ...values,
        occurredAt: localToIso(values.occurredAt),
        nextFollowUpAt: values.nextFollowUpAt ? localToIso(values.nextFollowUpAt) : undefined,
      }),
    invalidate: ["/activities", "/leads", "/clients", "/tasks", "/dashboard", "/opportunities"],
    onSuccess: () => {
      reset();
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log communication"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" form="log-form" type="submit" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="log-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="space-y-3"
        noValidate
      >
        <FormField label="Type" required>
          {(f) => (
            <Select {...f} {...register("commType")} options={toOptions(COMMUNICATION_TYPES)} />
          )}
        </FormField>
        <FormField label="Subject" required error={errors.subject?.message}>
          {(f) => <Input {...f} {...register("subject")} />}
        </FormField>
        <FormField label="Details">
          {(f) => <Textarea {...f} {...register("description")} />}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Date and time" required error={errors.occurredAt?.message}>
            {(f) => <DatePicker withTime {...f} {...register("occurredAt")} />}
          </FormField>
          <FormField label="Next follow-up">
            {(f) => <DatePicker withTime {...f} {...register("nextFollowUpAt")} />}
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export function ActivityTimeline({
  relation,
  kind,
  canLog = true,
  timezone,
}: {
  relation: { lead?: string; client?: string; project?: string };
  kind?: "SYSTEM" | "COMMUNICATION";
  canLog?: boolean;
  /** When set (a client's zone), times show in that zone so meeting times read correctly. */
  timezone?: string;
}) {
  const format = useFormat();
  const { can } = useMe();
  const [page, setPage] = useState(1);
  const [logging, setLogging] = useState(false);
  const { items, meta, isLoading, error, refetch } = useApiList<Activity>("/activities", {
    ...relation,
    kind,
    page,
    limit: 20,
  });
  const showLog = canLog && can("activity:write") && kind !== "SYSTEM" && !relation.project;

  return (
    <div>
      {showLog && (
        <div className="flex justify-end border-b border-line p-3">
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setLogging(true)}>
            Log communication
          </Button>
        </div>
      )}
      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !items.length ? (
        <EmptyState
          icon={ActivityIcon}
          title={kind === "COMMUNICATION" ? "No communication logged yet" : "No activity yet"}
        />
      ) : (
        <ol className="divide-y divide-line">
          {items.map((item) => {
            const Icon = (item.commType && ICONS[item.commType]) || ActivityIcon;
            return (
              <li key={item._id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.kind === "COMMUNICATION"
                      ? `${label(item.commType)}: ${item.subject}`
                      : item.description}
                  </p>
                  {item.kind === "COMMUNICATION" && item.description && (
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink-2">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-ink-3">
                    {item.actor?.name ?? "System"} · {format.dateTime(item.occurredAt, timezone)}
                    {item.nextFollowUpAt
                      ? ` · Follow up ${format.dateTime(item.nextFollowUpAt, timezone)}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {meta && meta.pages > 1 && (
        <Pagination page={meta.page} pages={meta.pages} total={meta.total} onChange={setPage} />
      )}
      {showLog && (
        <LogModal
          open={logging}
          onClose={() => setLogging(false)}
          relation={{ lead: relation.lead, client: relation.client }}
        />
      )}
    </div>
  );
}
