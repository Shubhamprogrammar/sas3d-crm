"use client";

import { Download, FileUp, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  useToast,
} from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { api, downloadFile } from "@/services/api";
import type { Attachment } from "@/types";
import { fileSize } from "@/utils/format";

export function AttachmentsPanel({
  entityType,
  entityId,
}: {
  entityType: "LEAD" | "CLIENT" | "PROJECT";
  entityId: string;
}) {
  const { can, me } = useMe();
  const format = useFormat();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const { data, isLoading, error, refetch } = useApiQuery<Attachment[]>("/attachments", {
    entityType,
    entityId,
  });

  const upload = useApiMutation<File>({
    request: (file) => {
      const form = new FormData();
      form.append("entityType", entityType);
      form.append("entityId", entityId);
      form.append("file", file);
      return api.upload("/attachments", form);
    },
    invalidate: ["/attachments", "/activities"],
  });
  const remove = useApiMutation<string>({
    request: (id) => api.delete(`/attachments/${id}`),
    invalidate: ["/attachments"],
    onSuccess: () => setRemoving(null),
  });

  const isAdmin = me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN";
  return (
    <div>
      {can("attachment:write") && (
        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
          <p className="text-xs text-ink-3">PDF, images, Office documents, ZIP or text files.</p>
          <input
            ref={input}
            type="file"
            hidden
            aria-label="Choose a file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = "";
            }}
          />
          <Button
            size="sm"
            loading={upload.isPending}
            icon={<FileUp className="size-4" />}
            onClick={() => input.current?.click()}
          >
            Upload file
          </Button>
        </div>
      )}
      {isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState icon={Paperclip} title="No files yet" />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((file) => (
            <li key={file._id} className="flex items-center gap-3 px-4 py-2.5">
              <Paperclip className="size-4 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.filename}</p>
                <p className="text-xs text-ink-3">
                  {fileSize(file.size)} · {file.uploadedBy?.name} · {format.date(file.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Download ${file.filename}`}
                icon={<Download className="size-4" />}
                onClick={() =>
                  downloadFile(`/attachments/${file._id}/download`, file.filename).catch(
                    (e: Error) => toast.error(e.message),
                  )
                }
              />
              {(isAdmin || file.uploadedBy?._id === me?.user._id) && can("attachment:write") && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${file.filename}`}
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setRemoving(file)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing._id)}
        loading={remove.isPending}
        danger
        confirmLabel="Delete file"
        title="Delete this file?"
        message={`${removing?.filename} will be permanently removed.`}
      />
    </div>
  );
}
