import type { ChildNode, Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import sanitizeHtml from "sanitize-html";

/** Only images uploaded through the notes image route may be embedded. */
export const IMAGE_SRC = /^\/api\/v1\/notes\/images\/([a-f\d]{24})$/i;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\))$/i;
const ALIGN = /^(left|right|center|justify)$/;

/** Mirrors the editor's extensions; anything else the client sends is dropped. */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "strong",
    "em",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "hr",
    "a",
    "mark",
    "span",
    "label",
    "input",
    "div",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    ol: ["start"],
    ul: [{ name: "data-type", multiple: false, values: ["taskList"] }],
    li: [
      { name: "data-type", multiple: false, values: ["taskItem"] },
      { name: "data-checked", multiple: false, values: ["true", "false"] },
    ],
    input: [{ name: "type", multiple: false, values: ["checkbox"] }, "checked", "disabled"],
    span: [
      "style",
      { name: "data-type", multiple: false, values: ["mention"] },
      "data-id",
      "data-label",
    ],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    img: ["src", "alt", "title"],
    code: ["class"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedStyles: { "*": { color: [COLOR], "text-align": [ALIGN] } },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
  exclusiveFilter: (frame) =>
    (frame.tag === "img" && !IMAGE_SRC.test(frame.attribs.src ?? "")) ||
    (frame.tag === "input" && frame.attribs.type !== "checkbox"),
};

export const sanitizeNoteHtml = (html: string) => sanitizeHtml(html, OPTIONS);

const BLOCKS = new Set(["p", "h2", "h3", "li", "blockquote", "pre", "div", "hr"]);

export interface ProcessedContent {
  content: string;
  contentText: string;
  mentions: string[];
  images: string[];
}

/** Sanitises editor HTML and derives the searchable text, mentioned users and embedded images. */
export function processNoteContent(html: string): ProcessedContent {
  const content = sanitizeNoteHtml(html);
  const mentions = new Set<string>();
  const images = new Set<string>();
  let text = "";

  const walk = (nodes: ChildNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        text += (node as unknown as { data: string }).data;
        continue;
      }
      if (node.type !== "tag") continue;
      const el = node as Element;
      if (el.name === "br") text += "\n";
      if (el.name === "span" && el.attribs["data-type"] === "mention") {
        const id = el.attribs["data-id"];
        if (id && OBJECT_ID.test(id)) mentions.add(id.toLowerCase());
      }
      if (el.name === "img") {
        const id = IMAGE_SRC.exec(el.attribs.src ?? "")?.[1];
        if (id) images.add(id.toLowerCase());
      }
      walk(el.children);
      if (BLOCKS.has(el.name)) text += "\n";
    }
  };
  walk(parseDocument(content).children);

  const contentText = text
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { content, contentText, mentions: [...mentions], images: [...images] };
}
