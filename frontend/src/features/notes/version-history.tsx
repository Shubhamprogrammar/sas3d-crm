"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Modal,
} from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { Note, NoteVersion } from "@/types";
import { timeAgo } from "@/utils/format";
import { RichTextEditor } from "./rich-text-editor";

export function VersionHistory({
  open,
  note,
  onClose,
  onRestored,
}: {
  open: boolean;
  note: Note;
  onClose: () => void;
  onRestored: (note: Note) => void;
}) {
  const format = useFormat();
  const versions = useApiQuery<NoteVersion[]>(open ? `/notes/${note._id}/versions` : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const version = useApiQuery<NoteVersion>(
    open && selected ? `/notes/${note._id}/versions/${selected}` : null,
  );

  useEffect(() => {
    if (!open) setSelected(null);
    else if (!selected && versions.data?.length) setSelected(versions.data[0]._id);
  }, [open, selected, versions.data]);

  const restore = useApiMutation<void, Note>({
    request: () => api.post<Note>(`/notes/${note._id}/versions/${selected}/restore`),
    invalidate: [`/notes/${note._id}/versions`],
    onSuccess: (saved) => {
      setConfirming(false);
      onRestored(saved);
    },
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="max-w-4xl"
        title="Version history"
        description="A copy is kept each time the title or description is saved (latest 50)."
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {note.canEdit && (
              <Button
                variant="primary"
                disabled={!version.data}
                onClick={() => setConfirming(true)}
              >
                Restore this version
              </Button>
            )}
          </>
        }
      >
        {versions.error ? (
          <ErrorState error={versions.error} onRetry={versions.refetch} />
        ) : versions.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : !versions.data?.length ? (
          <EmptyState
            icon={History}
            title="No earlier versions yet"
            description="Older versions appear here after the note is edited."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <ol className="max-h-[55dvh] space-y-1 overflow-y-auto md:border-r md:border-line md:pr-3">
              {versions.data.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item._id)}
                    aria-current={selected === item._id}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] ${selected === item._id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
                  >
                    <span className="block font-medium" title={format.dateTime(item.editedAt)}>
                      {timeAgo(item.editedAt)}
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {item.editedBy?.name ?? "Unknown"} · {item.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="min-w-0">
              {version.isLoading || !version.data ? (
                <LoadingSkeleton rows={5} />
              ) : (
                <article className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">{version.data.title}</h3>
                    <p className="text-xs text-ink-3">
                      Written by {version.data.editedBy?.name ?? "unknown"},{" "}
                      {format.dateTime(version.data.editedAt)}
                    </p>
                  </div>
                  {version.data.content ? (
                    <RichTextEditor
                      key={version.data._id}
                      value={version.data.content}
                      editable={false}
                    />
                  ) : (
                    <p className="text-ink-3">No description in this version.</p>
                  )}
                </article>
              )}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => restore.mutate()}
        loading={restore.isPending}
        title="Restore this version?"
        message="The current title and description are replaced. They stay in the history, so this can be undone."
        confirmLabel="Restore"
      />
    </>
  );
}
