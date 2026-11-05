"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Button,
  EmptyState,
  FormField,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { ProjectUpdate } from "@/types";

export function UpdatesPanel({ project }: { project: string }) {
  const { can } = useMe();
  const format = useFormat();
  const path = `/projects/${project}/updates`;
  const { items } = useApiList<ProjectUpdate>(path, { limit: 50 });
  const [type, setType] = useState("UPDATE");
  const [content, setContent] = useState("");
  const add = useApiMutation({
    request: () => api.post(path, { type, content }),
    invalidate: [path, "/activities"],
    onSuccess: () => setContent(""),
  });
  return (
    <div>
      {can("activity:write") && (
        <div className="space-y-2 border-b border-line p-4">
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <FormField label="Type">
              {(f) => (
                <Select
                  {...f}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  options={[
                    { value: "UPDATE", label: "Update" },
                    { value: "WORK_NOTE", label: "Work note" },
                    { value: "CLIENT_FEEDBACK", label: "Client feedback" },
                  ]}
                />
              )}
            </FormField>
            <FormField label="Message">
              {(f) => (
                <Textarea
                  rows={2}
                  {...f}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={!content.trim()}
              loading={add.isPending}
              onClick={() => add.mutate()}
            >
              Post
            </Button>
          </div>
        </div>
      )}
      {!items.length ? (
        <EmptyState icon={MessageSquare} title="No updates yet" />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((update) => (
            <li key={update._id} className="flex gap-3 px-4 py-3">
              <Avatar name={update.author?.name} image={update.author?.image} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium">{update.author?.name}</span>
                  <StatusBadge status={update.type} />
                  <span className="text-xs text-ink-3">
                    <span className="font-mono">{format.dateTime(update.createdAt)}</span>
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap">{update.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
