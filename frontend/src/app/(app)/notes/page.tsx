"use client";

import { Lock, NotebookPen, Pencil, Pin, PinOff, Plus, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
} from "@/components/ui";
import { NoteEditor } from "@/features/notes/note-editor";
import { useApiList, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { Note } from "@/types";
import { timeAgo } from "@/utils/format";

export default function NotesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const { can } = useMe();
  const list = useListState({ scope: "", tag: "", pinned: "" });
  const { items, meta, isLoading, error, refetch } = useApiList<Note>("/notes", list.params);
  const { data: tags = [] } = useApiQuery<string[]>("/notes/tags");

  // Search results, notifications and quick-create link here with ?note=<id> or ?new=1.
  // Permissions load after the first render, so the link is re-read when they arrive.
  const requested =
    query.get("note") ?? (query.get("new") === "1" && can("note:write") ? "new" : null);
  const [open, setOpen] = useState<string | "new" | null>(requested);
  const [startEditing, setStartEditing] = useState(false);
  const [lastRequested, setLastRequested] = useState(requested);
  if (requested !== lastRequested) {
    setLastRequested(requested);
    if (requested) {
      setOpen(requested);
      setStartEditing(false);
    }
  }

  const openNote = (id: string, edit = false) => {
    setOpen(id);
    setStartEditing(edit);
  };

  const close = () => {
    setOpen(null);
    setStartEditing(false);
    if (query.get("note") || query.get("new")) router.replace(pathname, { scroll: false });
  };

  const pin = useApiMutation<Note>({
    request: (note) => api.patch(`/notes/${note._id}/pin`, { pinned: !note.pinned }),
    invalidate: ["/notes"],
  });

  return (
    <>
      <PageHeader
        title="Notes"
        description="Meeting notes, requirements and ideas. Private by default; share with the team when ready."
        actions={
          can("note:write") && (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setOpen("new")}
            >
              New note
            </Button>
          )
        }
      />

      <Card padded={false} className="mb-4">
        <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search notes" />
          <Select
            aria-label="Show"
            value={list.filters.scope}
            onChange={(e) => list.setFilter("scope", e.target.value)}
            options={[
              { value: "mine", label: "My notes" },
              { value: "team", label: "Shared with team" },
            ]}
            placeholder="All notes"
          />
          <Select
            aria-label="Tag"
            value={list.filters.tag}
            onChange={(e) => list.setFilter("tag", e.target.value)}
            options={tags.map((tag) => ({ value: tag, label: `#${tag}` }))}
            placeholder="All tags"
          />
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line-strong px-3 text-[13px]">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={list.filters.pinned === "true"}
              onChange={(e) => list.setFilter("pinned", e.target.checked ? "true" : "")}
            />
            Pinned only
          </label>
        </div>
      </Card>

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title={list.hasFilters ? "No notes match these filters" : "No notes yet"}
            description={
              list.hasFilters
                ? "Try a different search, tag or filter."
                : "Capture meeting notes, requirements and checklists in one place."
            }
            action={
              list.hasFilters ? (
                <Button onClick={list.clear}>Clear filters</Button>
              ) : (
                can("note:write") && (
                  <Button
                    variant="primary"
                    icon={<Plus className="size-4" />}
                    onClick={() => setOpen("new")}
                  >
                    New note
                  </Button>
                )
              )
            }
          />
        </Card>
      ) : (
        <ul aria-label="Notes" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((note) => (
            <li key={note._id}>
              <NoteCard
                note={note}
                onOpen={() => openNote(note._id)}
                onEdit={() => openNote(note._id, true)}
                onPin={() => pin.mutate(note)}
                onTag={(tag) => list.setFilter("tag", tag)}
              />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.pages > 1 && (
        <Card padded={false} className="mt-4">
          <Pagination
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            onChange={list.setPage}
          />
        </Card>
      )}

      <NoteEditor
        open={open !== null}
        noteId={open === "new" ? null : open}
        startEditing={startEditing}
        onClose={close}
        onCreated={(note) => {
          openNote(note._id);
          if (query.get("new")) router.replace(pathname, { scroll: false });
        }}
      />
    </>
  );
}

function NoteCard({
  note,
  onOpen,
  onEdit,
  onPin,
  onTag,
}: {
  note: Note;
  onOpen: () => void;
  onEdit: () => void;
  onPin: () => void;
  onTag: (tag: string) => void;
}) {
  const format = useFormat();
  const editor = note.updatedBy?.name ?? note.createdBy?.name;
  return (
    <article
      className={`group relative flex h-full flex-col rounded-xl border bg-surface p-4 shadow-card transition-colors hover:border-line-strong ${note.pinned ? "border-accent/40" : "border-line"}`}
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 font-semibold leading-snug">
          {/* The stretched button makes the whole card open the note. */}
          <button
            type="button"
            onClick={onOpen}
            className="line-clamp-2 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {note.title}
          </button>
        </h2>
        {note.canEdit ? (
          <button
            type="button"
            onClick={onPin}
            aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
            title={note.pinned ? "Unpin" : "Pin to top"}
            className={`relative z-10 -m-1 rounded-md p-1 ${note.pinned ? "text-accent" : "text-ink-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"}`}
          >
            {note.pinned ? (
              <PinOff className="size-4" aria-hidden />
            ) : (
              <Pin className="size-4" aria-hidden />
            )}
          </button>
        ) : (
          note.pinned && (
            <Pin className="size-4 shrink-0 fill-current text-accent" aria-label="Pinned" />
          )
        )}
      </div>

      <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line text-[13px] text-ink-2">
        {note.contentText || <span className="text-ink-3">No description</span>}
      </p>

      {note.tags.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTag(tag)}
              title={`Show notes tagged ${tag}`}
              className="rounded-full bg-neutral-soft px-2 py-0.5 text-xs text-ink-2 hover:bg-accent-soft hover:text-accent"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-3">
        <Avatar name={editor} image={note.updatedBy?.image ?? note.createdBy?.image} size="sm" />
        <span className="min-w-0 flex-1 truncate" title={format.dateTime(note.updatedAt)}>
          Edited by {editor ?? "unknown"}, {timeAgo(note.updatedAt)}
        </span>
        {note.canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${note.title}`}
            title="Edit note"
            className="relative z-10 -m-1 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
        {note.visibility === "TEAM" ? (
          <span className="inline-flex items-center gap-1" title="Shared with team">
            <Users className="size-3.5" aria-hidden />
            <span className="sr-only">Shared with team</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1" title="Private: only you can see this">
            <Lock className="size-3.5" aria-hidden />
            <span className="sr-only">Private</span>
          </span>
        )}
      </footer>
    </article>
  );
}
