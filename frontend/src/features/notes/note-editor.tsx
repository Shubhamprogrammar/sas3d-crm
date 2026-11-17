"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  History,
  Lock,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ConfirmationDialog,
  Drawer,
  Dropdown,
  ErrorState,
  FormField,
  Input,
  LoadingSkeleton,
  Select,
  useToast,
  type MenuItem,
} from "@/components/ui";
import { invalidatePaths, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { api, ApiError, downloadFile } from "@/services/api";
import type { Note, NoteVisibility } from "@/types";
import { splitList, timeAgo } from "@/utils/format";
import { RichTextEditor } from "./rich-text-editor";
import { VersionHistory } from "./version-history";

interface Fields {
  title: string;
  content: string;
  tags: string;
  visibility: NoteVisibility;
}
interface Draft extends Fields {
  /** The server version the draft was based on, for detecting edits made elsewhere since. */
  baseUpdatedAt: string | null;
  savedAt: string;
}

const EMPTY: Fields = { title: "", content: "", tags: "", visibility: "PRIVATE" };
const draftKey = (id: string | null) => `sas3d-crm:note-draft:${id ?? "new"}`;

function readDraft(id: string | null): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string | null, draft: Draft) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    // Storage can be full or blocked; the in-memory form still works.
  }
}
function clearDraft(id: string | null) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // Nothing to clear.
  }
}

const fieldsOf = (note: Note): Fields => ({
  title: note.title,
  content: note.content ?? "",
  tags: note.tags.join(", "),
  visibility: note.visibility,
});
const sameFields = (a: Fields, b: Fields) =>
  a.title === b.title &&
  a.content === b.content &&
  a.visibility === b.visibility &&
  splitList(a.tags).join(",").toLowerCase() === splitList(b.tags).join(",").toLowerCase();

const INVALIDATE = ["/notes", "/search"];

/** Create, view or edit one note. `noteId` is null for a new note. */
export function NoteEditor({
  open,
  noteId,
  onClose,
  onCreated,
}: {
  open: boolean;
  noteId: string | null;
  onClose: () => void;
  onCreated: (note: Note) => void;
}) {
  const toast = useToast();
  const format = useFormat();
  const { me } = useMe();
  const queryClient = useQueryClient();
  const {
    data: note,
    isLoading,
    error,
    refetch,
  } = useApiQuery<Note>(open && noteId ? `/notes/${noteId}` : null);

  const [initial, setInitial] = useState<Fields>(EMPTY);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [base, setBase] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [restored, setRestored] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const canEdit = noteId ? Boolean(note?.canEdit) : true;
  // Administrators may edit a teammate's shared note, but only its author decides who sees it.
  const isAuthor = !note || note.createdBy?._id === me?.user._id;
  const dirty = ready && canEdit && !sameFields(fields, initial);

  /** Loads server state, then layers any unsaved local draft on top of it. */
  const load = useCallback(
    (server: Fields, updatedAt: string | null, useDraft = true) => {
      const draft = useDraft ? readDraft(noteId) : null;
      const start = draft && !sameFields(draft, server) ? draft : null;
      setInitial(server);
      setFields(start ?? server);
      setBase(updatedAt);
      setRestored(start);
      setTitleError("");
      setEditorKey((key) => key + 1);
      setReady(true);
    },
    [noteId],
  );

  useEffect(() => {
    if (!open) {
      loadedFor.current = null;
      setReady(false);
      return;
    }
    if (!noteId) {
      if (loadedFor.current !== "new") {
        loadedFor.current = "new";
        load(EMPTY, null);
      }
      return;
    }
    if (note && loadedFor.current !== note._id) {
      loadedFor.current = note._id;
      load(fieldsOf(note), note.updatedAt, note.canEdit);
    }
  }, [open, noteId, note, load]);

  // Autosave the working copy locally while typing.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(
      () =>
        writeDraft(noteId, { ...fields, baseUpdatedAt: base, savedAt: new Date().toISOString() }),
      400,
    );
    return () => clearTimeout(timer);
  }, [dirty, fields, base, noteId]);

  // Warn before a refresh or tab close would lose unsaved edits.
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);

  const save = useApiMutation<void, Note>({
    request: () => {
      const body = {
        title: fields.title.trim(),
        content: fields.content,
        tags: splitList(fields.tags),
        visibility: fields.visibility,
      };
      return noteId
        ? api.patch<Note>(`/notes/${noteId}`, { ...body, ...(base ? { baseUpdatedAt: base } : {}) })
        : api.post<Note>("/notes", body);
    },
    invalidate: INVALIDATE,
    onSuccess: (saved) => {
      clearDraft(noteId);
      queryClient.setQueryData([`/notes/${saved._id}`, {}], saved);
      if (!noteId) {
        // Hand over to edit mode already loaded, so nothing reloads or autosaves in between.
        loadedFor.current = saved._id;
        load(fieldsOf(saved), saved.updatedAt, false);
        onCreated(saved);
        return;
      }
      const server = fieldsOf(saved);
      setInitial(server);
      setFields(server);
      setBase(saved.updatedAt);
      setRestored(null);
    },
    onError: (err) => {
      const titleIssue = err.errors.find((issue) => issue.path === "title");
      if (titleIssue?.message) setTitleError(titleIssue.message);
    },
  });

  const pin = useApiMutation<boolean>({
    request: (pinned) => api.patch(`/notes/${noteId}/pin`, { pinned }),
    invalidate: INVALIDATE,
  });
  const remove = useApiMutation({
    request: () => api.delete(`/notes/${noteId}`),
    invalidate: INVALIDATE,
    onSuccess: () => {
      clearDraft(noteId);
      setConfirmDelete(false);
      onClose();
    },
  });

  function submit() {
    if (!canEdit || save.isPending) return;
    if (!fields.title.trim()) {
      setTitleError("Title is required");
      return;
    }
    save.mutate();
  }

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else {
      clearDraft(noteId);
      onClose();
    }
  }

  function discardDraft() {
    clearDraft(noteId);
    if (noteId && note) load(fieldsOf(note), note.updatedAt, false);
    else load(EMPTY, null, false);
  }

  async function exportPdf() {
    if (!note) return;
    setDownloading(true);
    try {
      const name = note.title.replace(/[^\w\- ]+/g, "").trim() || "note";
      await downloadFile(`/notes/${note._id}/pdf`, `${name}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "The PDF could not be created");
    } finally {
      setDownloading(false);
    }
  }

  const menu: MenuItem[] = useMemo(
    () =>
      note
        ? [
            {
              label: note.pinned ? "Unpin" : "Pin to top",
              icon: note.pinned ? PinOff : Pin,
              hidden: !note.canEdit,
              onClick: () => pin.mutate(!note.pinned),
            },
            { label: "Download PDF", icon: Download, onClick: () => void exportPdf() },
            { label: "Version history", icon: History, onClick: () => setHistory(true) },
            {
              label: "Delete note",
              icon: Trash2,
              danger: true,
              hidden: !note.canEdit,
              onClick: () => setConfirmDelete(true),
            },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note],
  );

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const description = note ? (
    <span>
      {note.createdBy?.name && <>By {note.createdBy.name} · </>}
      <span title={format.dateTime(note.updatedAt)}>
        Edited{note.updatedBy?.name ? ` by ${note.updatedBy.name}` : ""}, {timeAgo(note.updatedAt)}
      </span>
      {note.pinned && <> · Pinned</>}
    </span>
  ) : undefined;

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        width="max-w-3xl"
        title={noteId ? (canEdit ? "Edit note" : "Note") : "New note"}
        description={description}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {note && (
              <Dropdown
                items={menu}
                align="left"
                ariaLabel="Note actions"
                trigger={
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium shadow-card hover:bg-surface-2">
                    <MoreHorizontal className="size-4" aria-hidden />
                    {downloading ? "Preparing PDF…" : "More"}
                  </span>
                }
              />
            )}
            <span className="flex-1" />
            {canEdit && (
              <span className="hidden text-xs text-ink-3 sm:inline" aria-live="polite">
                {dirty
                  ? "Unsaved changes · draft kept on this device"
                  : ready && noteId
                    ? "All changes saved"
                    : ""}
              </span>
            )}
            <Button onClick={requestClose}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && (
              <Button
                variant="primary"
                onClick={submit}
                loading={save.isPending}
                disabled={!ready || (Boolean(noteId) && !dirty)}
                title="Save (Ctrl+S)"
              >
                Save
              </Button>
            )}
          </div>
        }
      >
        {noteId && error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !ready || (noteId && isLoading) ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <div
            className="space-y-3"
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                submit();
              }
            }}
          >
            {restored && (
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn"
                role="status"
              >
                <RotateCcw className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  Restored unsaved changes from {timeAgo(restored.savedAt)}.
                  {note &&
                    restored.baseUpdatedAt !== note.updatedAt &&
                    " This note has been edited since; saving will be refused until you reload it."}
                </span>
                <Button size="sm" variant="ghost" onClick={discardDraft}>
                  Discard draft
                </Button>
              </div>
            )}

            {canEdit ? (
              <>
                <FormField label="Title" required error={titleError}>
                  {(f) => (
                    <Input
                      {...f}
                      autoFocus={!noteId}
                      maxLength={200}
                      value={fields.title}
                      placeholder="e.g. Kick-off call with Acme"
                      onChange={(event) => {
                        set("title", event.target.value);
                        if (titleError) setTitleError("");
                      }}
                      className="h-10 text-base font-medium"
                    />
                  )}
                </FormField>
                <div>
                  <p className="mb-1 block text-[13px] font-medium text-ink-2">Description</p>
                  <RichTextEditor
                    key={editorKey}
                    value={fields.content}
                    onChange={(html) => set("content", html)}
                    onReady={(html) => {
                      // Re-base on the editor's serialisation so an untouched note is not "changed".
                      setInitial((current) =>
                        current.content === fields.content
                          ? { ...current, content: html }
                          : current,
                      );
                      setFields((current) => ({ ...current, content: html }));
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label="Tags"
                    hint="Separated by commas, e.g. meeting, requirement, call"
                  >
                    {(f) => (
                      <Input
                        {...f}
                        value={fields.tags}
                        onChange={(event) => set("tags", event.target.value)}
                        placeholder="meeting, call"
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Visibility"
                    hint={
                      !isAuthor
                        ? "Only the author can change who sees this note."
                        : fields.visibility === "TEAM"
                          ? "Everyone in the CRM can read it. @mentioned people are notified."
                          : "Only you can see it. Share it with the team to notify @mentions."
                    }
                  >
                    {(f) => (
                      <Select
                        {...f}
                        disabled={!isAuthor}
                        value={fields.visibility}
                        onChange={(event) =>
                          set("visibility", event.target.value as NoteVisibility)
                        }
                        options={[
                          { value: "PRIVATE", label: "Private (only me)" },
                          { value: "TEAM", label: "Shared with team" },
                        ]}
                      />
                    )}
                  </FormField>
                </div>
              </>
            ) : (
              note && <ReadOnlyNote note={note} />
            )}
          </div>
        )}
      </Drawer>

      <ConfirmationDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          clearDraft(noteId);
          onClose();
        }}
        title="Discard unsaved changes?"
        message="Your edits to this note have not been saved. Discarding them cannot be undone."
        confirmLabel="Discard changes"
        danger
      />
      <ConfirmationDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Delete this note?"
        message={<>“{note?.title}” will be removed for everyone who can see it.</>}
        confirmLabel="Delete note"
        danger
      />
      {note && (
        <VersionHistory
          open={history}
          note={note}
          onClose={() => setHistory(false)}
          onRestored={async (saved) => {
            setHistory(false);
            clearDraft(noteId);
            queryClient.setQueryData([`/notes/${saved._id}`, {}], saved);
            await invalidatePaths(queryClient, INVALIDATE);
            load(fieldsOf(saved), saved.updatedAt, false);
          }}
        />
      )}
    </>
  );
}

function ReadOnlyNote({ note }: { note: Note }) {
  return (
    <article className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{note.title}</h2>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
        {note.visibility === "TEAM" ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> Shared with team
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden /> Private
          </span>
        )}
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-neutral-soft px-2 py-0.5 text-ink-2">
            #{tag}
          </span>
        ))}
      </div>
      {note.content ? (
        <RichTextEditor value={note.content} editable={false} />
      ) : (
        <p className="text-ink-3">This note has no description.</p>
      )}
    </article>
  );
}
