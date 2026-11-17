import type { ChildNode, Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import PDFDocument from "pdfkit";
import { formatDocDate, toBuffer } from "../../services/pdf.service.js";
import { IMAGE_SRC } from "./content.js";

const MARGIN = 50;
const WIDTH = 495;
const INK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const LINK = "#2563EB";
const BODY_SIZE = 10.5;

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
  color?: string;
}

interface NoteForPdf {
  title: string;
  content: string;
  tags: string[];
  visibility: string;
  updatedAt: Date;
  createdBy?: { name?: string } | null;
  updatedBy?: { name?: string } | null;
}

const isTag = (node: ChildNode): node is Element => node.type === "tag";
const textOf = (node: ChildNode): string =>
  node.type === "text"
    ? (node as unknown as { data: string }).data
    : isTag(node)
      ? node.children.map(textOf).join("")
      : "";
/** Text colour from an inline style; browsers store it as hex or rgb(). */
function textColor(style = "") {
  const hex = /(?:^|;)\s*color:\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\b/i.exec(style)?.[1];
  if (hex) return hex;
  const rgb = /(?:^|;)\s*color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(style);
  if (!rgb) return undefined;
  return `#${rgb
    .slice(1, 4)
    .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function fontFor(run: Run) {
  if (run.code) return "Courier";
  if (run.bold && run.italic) return "Helvetica-BoldOblique";
  if (run.bold) return "Helvetica-Bold";
  if (run.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

/** Flattens inline markup into styled runs for pdfkit's `continued` text. */
function collectRuns(nodes: ChildNode[], style: Omit<Run, "text"> = {}, out: Run[] = []) {
  for (const node of nodes) {
    if (node.type === "text") {
      out.push({ ...style, text: (node as unknown as { data: string }).data });
      continue;
    }
    if (!isTag(node)) continue;
    const next = { ...style };
    switch (node.name) {
      case "strong":
        next.bold = true;
        break;
      case "em":
        next.italic = true;
        break;
      case "u":
        next.underline = true;
        break;
      case "s":
        next.strike = true;
        break;
      case "code":
        next.code = true;
        break;
      case "a":
        next.link = node.attribs.href;
        next.color = LINK;
        next.underline = true;
        break;
      case "br":
        out.push({ ...style, text: "\n" });
        continue;
      case "span":
        if (node.attribs["data-type"] === "mention") next.bold = true;
        next.color = textColor(node.attribs.style) ?? next.color;
        break;
    }
    collectRuns(node.children, next, out);
  }
  return out;
}

export async function notePdf(note: NoteForPdf, images: Map<string, Buffer>) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Title: note.title } });

  const ensureSpace = (height: number) => {
    if (doc.y + height > doc.page.height - MARGIN) doc.addPage();
  };

  function inline(
    nodes: ChildNode[],
    x: number,
    width: number,
    size = BODY_SIZE,
    base: Omit<Run, "text"> = {},
    align?: string,
  ) {
    const runs = collectRuns(nodes, base).filter((run) => run.text);
    if (!runs.length) {
      doc.font("Helvetica").fontSize(size).text(" ", x, doc.y, { width });
      return;
    }
    runs.forEach((run, index) => {
      doc
        .font(fontFor(run))
        .fontSize(run.code ? size - 1 : size)
        .fillColor(run.color ?? INK);
      const options = {
        width,
        continued: index < runs.length - 1,
        underline: Boolean(run.underline),
        strike: Boolean(run.strike),
        link: run.link ?? null,
        lineGap: 2,
        ...(align ? { align: align as "left" | "center" | "right" | "justify" } : {}),
      };
      if (index === 0) doc.text(run.text, x, doc.y, options);
      else doc.text(run.text, options);
    });
    doc.fillColor(INK);
  }

  function blocks(nodes: ChildNode[], indent: number) {
    for (const node of nodes) {
      if (node.type === "text") {
        if (textOf(node).trim()) inline([node], MARGIN + indent, WIDTH - indent);
        continue;
      }
      if (!isTag(node)) continue;
      const x = MARGIN + indent;
      const width = WIDTH - indent;
      const align = /text-align:\s*(left|right|center|justify)/.exec(node.attribs.style ?? "")?.[1];
      switch (node.name) {
        case "p":
          ensureSpace(16);
          inline(node.children, x, width, BODY_SIZE, {}, align);
          doc.moveDown(0.4);
          break;
        case "h2":
        case "h3":
          doc.moveDown(0.3);
          ensureSpace(30);
          inline(node.children, x, width, node.name === "h2" ? 15 : 12.5, { bold: true }, align);
          doc.moveDown(0.35);
          break;
        case "ul":
        case "ol":
          list(node, indent);
          doc.moveDown(0.2);
          break;
        case "blockquote": {
          const top = doc.y;
          blocks(node.children, indent + 14);
          doc
            .save()
            .moveTo(x + 3, top)
            .lineTo(x + 3, doc.y - 4)
            .lineWidth(2.5)
            .strokeColor(BORDER)
            .stroke()
            .restore();
          break;
        }
        case "pre": {
          const code = textOf(node).replace(/\n$/, "");
          doc.font("Courier").fontSize(9);
          const height = doc.heightOfString(code, { width: width - 16 }) + 12;
          ensureSpace(Math.min(height, 200));
          const top = doc.y;
          doc.save().rect(x, top, width, height).fill("#F1F5F9").restore();
          doc.fillColor(INK).text(code, x + 8, top + 6, { width: width - 16 });
          doc.y = top + height;
          doc.moveDown(0.5);
          break;
        }
        case "hr":
          ensureSpace(14);
          doc.moveDown(0.3);
          doc
            .moveTo(x, doc.y)
            .lineTo(x + width, doc.y)
            .lineWidth(0.75)
            .strokeColor(BORDER)
            .stroke();
          doc.moveDown(0.6);
          break;
        case "img": {
          const id = IMAGE_SRC.exec(node.attribs.src ?? "")?.[1]?.toLowerCase();
          const buffer = id ? images.get(id) : undefined;
          if (!buffer) {
            inline([], x, width);
            doc
              .font("Helvetica-Oblique")
              .fontSize(9)
              .fillColor(MUTED)
              .text("[Image not included]", x, doc.y, { width });
            doc.fillColor(INK).moveDown(0.4);
            break;
          }
          try {
            // pdfkit's typings omit openImage, which reads dimensions without drawing.
            const image = (
              doc as unknown as { openImage: (src: Buffer) => { width: number; height: number } }
            ).openImage(buffer);
            const scale = Math.min(1, width / image.width, 320 / image.height);
            const w = image.width * scale;
            const h = image.height * scale;
            ensureSpace(h + 8);
            const top = doc.y;
            doc.image(buffer, x, top, { width: w, height: h });
            doc.y = top + h + 8;
          } catch {
            // An unreadable image is skipped rather than failing the export.
          }
          break;
        }
        default:
          blocks(node.children, indent);
      }
    }
  }

  function list(node: Element, indent: number) {
    const ordered = node.name === "ol";
    const isTasks = node.attribs["data-type"] === "taskList";
    let number = Number(node.attribs.start ?? 1) || 1;
    const x = MARGIN + indent;
    for (const item of node.children.filter(isTag)) {
      if (item.name !== "li") continue;
      ensureSpace(16);
      const top = doc.y;
      if (isTasks) {
        const checked = item.attribs["data-checked"] === "true";
        doc
          .save()
          .lineWidth(0.9)
          .strokeColor(MUTED)
          .rect(x + 1, top + 2, 8.5, 8.5)
          .stroke();
        if (checked) {
          doc
            .moveTo(x + 2.8, top + 6.4)
            .lineTo(x + 4.8, top + 8.6)
            .lineTo(x + 8.6, top + 3.8)
            .lineWidth(1.3)
            .strokeColor(INK)
            .stroke();
        }
        doc.restore();
        const body = item.children.filter(isTag).find((child) => child.name === "div");
        doc.y = top;
        blocks(body?.children ?? [], indent + 16);
      } else {
        doc
          .font("Helvetica")
          .fontSize(BODY_SIZE)
          .fillColor(INK)
          .text(ordered ? `${number}.` : "•", x, top, { width: 16, lineBreak: false });
        doc.y = top;
        blocks(item.children, indent + 16);
        number += 1;
      }
    }
  }

  // Header
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(INK)
    .text(note.title, MARGIN, MARGIN, { width: WIDTH });
  const meta = [
    note.createdBy?.name ? `By ${note.createdBy.name}` : "",
    `Last edited ${formatDocDate(note.updatedAt)}${note.updatedBy?.name ? ` by ${note.updatedBy.name}` : ""}`,
    note.visibility === "TEAM" ? "Shared with team" : "Private",
  ].filter(Boolean);
  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(meta.join("  ·  "), { width: WIDTH });
  if (note.tags.length)
    doc.moveDown(0.2).text(note.tags.map((tag) => `#${tag}`).join("  "), { width: WIDTH });
  doc.moveDown(0.6);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + WIDTH, doc.y)
    .lineWidth(0.75)
    .strokeColor(BORDER)
    .stroke();
  doc.moveDown(0.8).fillColor(INK);

  blocks(parseDocument(note.content).children, 0);
  return toBuffer(doc);
}
