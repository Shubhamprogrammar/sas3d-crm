"use client";

import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Mention from "@tiptap/extension-mention";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, useToast } from "@/components/ui";
import { api } from "@/services/api";
import type { UserRef } from "@/types";

const IMAGE_SRC = "/api/v1/notes/images/";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_MB = 5;
const COLORS = [
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Grey", value: "#6b7280" },
];

/** Only images uploaded to the notes store are kept; pasted remote images are dropped. */
const NoteImage = Image.extend({
  parseHTML() {
    return [{ tag: `img[src^="${IMAGE_SRC}"]` }];
  },
});

interface MentionState {
  items: UserRef[];
  index: number;
  rect: DOMRect | null;
  command: (item: { id: string; label: string }) => void;
}

function normaliseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return null; // javascript:, data: and friends
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  return `https://${trimmed}`;
}

export function RichTextEditor({
  value,
  onChange,
  onReady,
  editable = true,
  placeholder = "Write your note. Type @ to mention a teammate, or paste an image.",
  autoFocus = false,
}: {
  value: string;
  onChange?: (html: string) => void;
  /**
   * Called once with the editor's own serialisation of `value`, which can differ from the input
   * (attribute order, defaults). Lets callers compare later edits against like-for-like HTML.
   */
  onReady?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(0);
  const [mention, setMention] = useState<MentionState | null>(null);
  const mentionRef = useRef<MentionState | null>(null);
  mentionRef.current = mention;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const editorRef = useRef<Editor | null>(null);

  async function uploadImages(files: File[], position?: number) {
    const images = files.filter((file) => IMAGE_TYPES.includes(file.type));
    if (!images.length) return false;
    for (const file of images) {
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_IMAGE_MB} MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.upload<{ src: string }>("/notes/images", form);
        const editor = editorRef.current;
        if (!editor) continue;
        const node = { type: "image", attrs: { src: data.src, alt: file.name } };
        if (position === undefined) editor.chain().focus().insertContent(node).run();
        else editor.chain().focus().insertContentAt(position, node).run();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The image could not be uploaded");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    return true;
  }
  const uploadRef = useRef(uploadImages);
  uploadRef.current = uploadImages;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    content: value,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: !editable,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url, ctx) =>
            /^(https?:|mailto:)/i.test(url) ||
            (!/^[a-z][a-z\d+.-]*:/i.test(url) && ctx.defaultValidate(url)),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      NoteImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: async ({ query }) => {
            try {
              return (await api.get<UserRef[]>("/notes/mentionable", { q: query })).data;
            } catch {
              return [];
            }
          },
          render: () => ({
            onStart: (props: SuggestionProps<UserRef>) =>
              setMention({
                items: props.items,
                index: 0,
                rect: props.clientRect?.() ?? null,
                command: props.command,
              }),
            onUpdate: (props: SuggestionProps<UserRef>) =>
              setMention({
                items: props.items,
                index: 0,
                rect: props.clientRect?.() ?? null,
                command: props.command,
              }),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              const current = mentionRef.current;
              if (!current?.items.length) return false;
              const count = current.items.length;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                setMention({ ...current, index: (current.index + step + count) % count });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const user = current.items[current.index];
                current.command({ id: user._id, label: user.name });
                return true;
              }
              if (event.key === "Escape") {
                setMention(null);
                return true;
              }
              return false;
            },
            onExit: () => setMention(null),
          }),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: `rich-text ${editable ? "min-h-64 px-4 py-3" : ""}`,
        ...(editable ? { "aria-label": "Note content", "aria-multiline": "true" } : {}),
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some((file) => IMAGE_TYPES.includes(file.type))) return false;
        void uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.some((file) => IMAGE_TYPES.includes(file.type))) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadRef.current(files, position);
        return true;
      },
    },
    onCreate: ({ editor: current }) =>
      onReadyRef.current?.(current.isEmpty ? "" : current.getHTML()),
    onUpdate: ({ editor: current }) =>
      onChangeRef.current?.(current.isEmpty ? "" : current.getHTML()),
  });
  editorRef.current = editor;

  useEffect(() => {
    // Without `false`, Tiptap emits an update here, which would look like a user edit.
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editable) return <EditorContent editor={editor} />;

  return (
    <div className="rounded-lg border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      {editor && <Toolbar editor={editor} onPickImages={(files) => uploadImages(files)} />}
      <EditorContent editor={editor} />
      {uploading > 0 && (
        <p
          className="flex items-center gap-1.5 border-t border-line px-4 py-1.5 text-xs text-ink-3"
          role="status"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Uploading image…
        </p>
      )}
      {mention && (
        <MentionList
          state={mention}
          onPick={(user) => mention.command({ id: user._id, label: user.name })}
        />
      )}
    </div>
  );
}

function MentionList({ state, onPick }: { state: MentionState; onPick: (user: UserRef) => void }) {
  if (!state.rect) return null;
  return (
    <div
      role="listbox"
      aria-label="Mention a teammate"
      className="fixed z-[60] w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop"
      style={{
        top: state.rect.bottom + 6,
        left: Math.min(state.rect.left, window.innerWidth - 272),
      }}
    >
      {state.items.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-ink-3">No matching teammates</p>
      ) : (
        state.items.map((user, index) => (
          <button
            key={user._id}
            type="button"
            role="option"
            aria-selected={index === state.index}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(user);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${index === state.index ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
          >
            <Avatar name={user.name} image={user.image} size="sm" />
            <span className="min-w-0 flex-1 truncate">{user.name}</span>
            {user.designation && (
              <span className="truncate text-xs text-ink-3">{user.designation}</span>
            )}
          </button>
        ))
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />;

function Popover({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-line bg-surface p-2 shadow-pop">
      {children}
    </div>
  );
}

function Toolbar({
  editor,
  onPickImages,
}: {
  editor: Editor;
  onPickImages: (files: File[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<"link" | "color" | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function openLink() {
    setLink((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError("");
    setPanel(panel === "link" ? null : "link");
  }
  function applyLink() {
    const href = normaliseUrl(link);
    if (href === null) {
      setLinkError("Only web and email links are allowed");
      return;
    }
    if (!href) chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href }).run();
    setPanel(null);
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-line bg-surface px-1.5 py-1"
    >
      <ToolButton
        icon={Undo2}
        label="Undo (Ctrl+Z)"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Redo (Ctrl+Shift+Z)"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
      <Divider />
      <ToolButton
        icon={Heading2}
        label="Heading"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={Heading3}
        label="Subheading"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Divider />
      <ToolButton
        icon={Bold}
        label="Bold (Ctrl+B)"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic (Ctrl+I)"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Underline (Ctrl+U)"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton
        icon={Highlighter}
        label="Highlight"
        active={state.highlight}
        onClick={() => chain().toggleHighlight().run()}
      />
      <div className="relative">
        <ToolButton
          icon={Palette}
          label="Text colour"
          active={Boolean(state.color)}
          onClick={() => setPanel(panel === "color" ? null : "color")}
        />
        {panel === "color" && (
          <Popover>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  chain().unsetColor().run();
                  setPanel(null);
                }}
                className="h-7 rounded-md border border-line px-2 text-xs text-ink-2 hover:bg-surface-2"
              >
                Default
              </button>
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  aria-label={color.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    chain().setColor(color.value).run();
                    setPanel(null);
                  }}
                  className={`size-7 rounded-md border-2 ${state.color === color.value ? "border-ink" : "border-transparent"}`}
                  style={{ background: color.value }}
                />
              ))}
            </div>
          </Popover>
        )}
      </div>
      <ToolButton
        icon={Code}
        label="Inline code"
        active={state.code}
        onClick={() => chain().toggleCode().run()}
      />
      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        icon={ListChecks}
        label="Checklist"
        active={state.task}
        onClick={() => chain().toggleTaskList().run()}
      />
      <Divider />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton
        icon={Code2}
        label="Code block"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      <ToolButton icon={Minus} label="Divider" onClick={() => chain().setHorizontalRule().run()} />
      <Divider />
      <ToolButton
        icon={AlignLeft}
        label="Align left"
        active={state.left}
        onClick={() => chain().setTextAlign("left").run()}
      />
      <ToolButton
        icon={AlignCenter}
        label="Align centre"
        active={state.center}
        onClick={() => chain().setTextAlign("center").run()}
      />
      <ToolButton
        icon={AlignRight}
        label="Align right"
        active={state.right}
        onClick={() => chain().setTextAlign("right").run()}
      />
      <Divider />
      <div className="relative">
        <ToolButton icon={Link2} label="Link" active={state.link} onClick={openLink} />
        {panel === "link" && (
          <Popover>
            <form
              className="flex w-72 flex-col gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                applyLink();
              }}
            >
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  onKeyDown={(event) => event.key === "Escape" && setPanel(null)}
                  placeholder="https://example.com"
                  aria-label="Link address"
                  className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13px] focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-8 rounded-md bg-accent px-2.5 text-xs font-medium text-on-accent"
                >
                  Apply
                </button>
              </div>
              {linkError && <p className="text-xs text-bad">{linkError}</p>}
              <p className="text-xs text-ink-3">Leave empty and apply to remove the link.</p>
            </form>
          </Popover>
        )}
      </div>
      <ToolButton
        icon={ImagePlus}
        label="Insert image"
        onClick={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          onPickImages(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <ToolButton
        icon={RemoveFormatting}
        label="Clear formatting"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
    </div>
  );
}
