import PDFDocument from "pdfkit";
import type { CompanySettingsData } from "../modules/settings/service.js";
import { formatMinor } from "../utils/money.js";

const BRAND = "#0F172A";
const ACCENT = "#2563EB";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495;

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
interface Totals {
  subtotal?: number | null;
  discountAmount?: number | null;
  discount?: { type?: string | null; value?: number | null } | null;
  taxAmount?: number | null;
  taxRateBp?: number | null;
  taxLabel?: string | null;
  total?: number | null;
  currency: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDocDate(date: Date | null | undefined, format = "DD MMM YYYY") {
  if (!date) return "";
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  if (format === "MM/DD/YYYY") return `${m}/${d}/${y}`;
  if (format === "DD/MM/YYYY") return `${d}/${m}/${y}`;
  if (format === "YYYY-MM-DD") return `${y}-${m}-${d}`;
  return `${d} ${MONTHS[date.getUTCMonth()]} ${y}`;
}

const bpToPercent = (bp: number) => (bp / 100).toFixed(2).replace(/\.?0+$/, "");

function toBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function header(
  doc: PDFKit.PDFDocument,
  settings: CompanySettingsData,
  title: string,
  number: string,
) {
  const company = settings.company;
  const top = PAGE_MARGIN;
  let logoDrawn = false;
  const logo = company?.logoUrl?.match(/^data:image\/(?:png|jpeg);base64,(.+)$/)?.[1];
  if (logo) {
    try {
      doc.image(Buffer.from(logo, "base64"), PAGE_MARGIN, top, { fit: [120, 44] });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn)
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(BRAND)
      .text(company?.name ?? "SAS3D", PAGE_MARGIN, top);

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(ACCENT)
    .text(title.toUpperCase(), PAGE_MARGIN, top, { align: "right", width: CONTENT_WIDTH });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(number, PAGE_MARGIN, top + 26, { align: "right", width: CONTENT_WIDTH });

  const contact = [company?.website, company?.email, company?.phone].filter(Boolean).join("  |  ");
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  let y = top + 50;
  if (company?.address) {
    doc.text(company.address, PAGE_MARGIN, y, { width: 300 });
    y = doc.y;
  }
  if (contact) {
    doc.text(contact, PAGE_MARGIN, y, { width: 400 });
    y = doc.y;
  }
  if (company?.taxInfo) {
    doc.text(company.taxInfo, PAGE_MARGIN, y, { width: 400 });
    y = doc.y;
  }
  doc
    .moveTo(PAGE_MARGIN, y + 8)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 8)
    .strokeColor(ACCENT)
    .lineWidth(1.5)
    .stroke();
  doc.y = y + 20;
  doc.x = PAGE_MARGIN;
}

const ensureSpace = (doc: PDFKit.PDFDocument, needed: number) => {
  if (doc.y + needed > doc.page.height - 70) doc.addPage();
};

function section(doc: PDFKit.PDFDocument, title: string, body?: string | null) {
  if (!body?.trim()) return;
  ensureSpace(doc, 50);
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND)
    .text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.25);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(body, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
}

function bullets(doc: PDFKit.PDFDocument, title: string, items?: string[] | null) {
  if (!items?.length) return;
  section(doc, title, items.map((item) => `•  ${item}`).join("\n"));
}

function itemsTable(doc: PDFKit.PDFDocument, items: LineItem[], currency: string) {
  const columns = { description: PAGE_MARGIN + 8, quantity: 310, unit: 360, amount: 450 };
  const drawHead = () => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 22).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
    doc.text("Description", columns.description, y + 7);
    doc.text("Qty", columns.quantity, y + 7, { width: 40, align: "right" });
    doc.text("Unit price", columns.unit, y + 7, { width: 85, align: "right" });
    doc.text("Amount", columns.amount, y + 7, { width: 87, align: "right" });
    doc.y = y + 28;
  };
  ensureSpace(doc, 60);
  doc.moveDown(0.6);
  drawHead();
  for (const item of items) {
    doc.font("Helvetica").fontSize(9.5);
    const height = doc.heightOfString(item.description, { width: 245 });
    if (doc.y + height + 12 > doc.page.height - 70) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    doc.font("Helvetica").fontSize(9.5).fillColor("#1E293B");
    doc.text(item.description, columns.description, y, { width: 245 });
    doc.text(String(item.quantity), columns.quantity, y, { width: 40, align: "right" });
    doc.text(formatMinor(item.unitPrice, currency), columns.unit, y, { width: 85, align: "right" });
    doc.text(formatMinor(item.amount, currency), columns.amount, y, { width: 87, align: "right" });
    const next = y + height + 6;
    doc
      .moveTo(PAGE_MARGIN, next)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, next)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();
    doc.y = next + 6;
  }
}

function totalsBlock(
  doc: PDFKit.PDFDocument,
  totals: Totals,
  extra: { label: string; value: number }[] = [],
) {
  const { currency } = totals;
  const row = (label: string, amount: string, bold = false) => {
    const y = doc.y;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 11 : 9.5)
      .fillColor(bold ? BRAND : "#334155");
    doc.text(label, 300, y, { width: 130 });
    doc.text(amount, 430, y, { width: 107, align: "right" });
    doc.y = y + (bold ? 18 : 15);
  };
  ensureSpace(doc, 110);
  doc.moveDown(0.5);
  row("Subtotal", formatMinor(totals.subtotal ?? 0, currency));
  if (totals.discountAmount) {
    const label =
      totals.discount?.type === "PERCENT"
        ? `Discount (${bpToPercent(totals.discount.value ?? 0)}%)`
        : "Discount";
    row(label, `-${formatMinor(totals.discountAmount, currency)}`);
  }
  if (totals.taxRateBp)
    row(
      `${totals.taxLabel || "Tax"} (${bpToPercent(totals.taxRateBp)}%)`,
      formatMinor(totals.taxAmount ?? 0, currency),
    );
  doc
    .moveTo(300, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor(BRAND)
    .lineWidth(0.8)
    .stroke();
  doc.y += 5;
  row("Total", formatMinor(totals.total ?? 0, currency), true);
  for (const line of extra)
    row(line.label, formatMinor(line.value, currency), line.label === "Balance due");
  doc.x = PAGE_MARGIN;
}

function footers(doc: PDFKit.PDFDocument, text: string) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    // Writing into the bottom margin would otherwise trigger an automatic page break.
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.text(text, PAGE_MARGIN, doc.page.height - 40, {
      width: CONTENT_WIDTH - 60,
      lineBreak: false,
    });
    doc.text(
      `Page ${index - range.start + 1} of ${range.count}`,
      PAGE_MARGIN,
      doc.page.height - 40,
      { width: CONTENT_WIDTH, align: "right", lineBreak: false },
    );
    doc.page.margins.bottom = margin;
  }
}

function party(
  doc: PDFKit.PDFDocument,
  label: string,
  lines: (string | null | undefined)[],
  x: number,
  y: number,
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(MUTED)
    .text(label.toUpperCase(), x, y, { width: 230 });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1E293B")
    .text(lines.filter(Boolean).join("\n"), x, doc.y + 3, { width: 230, lineGap: 1 });
  return doc.y;
}

interface ProposalData extends Totals {
  number: string;
  title: string;
  description?: string | null;
  scope?: string | null;
  deliverables?: string[] | null;
  technologies?: string[] | null;
  timeline?: string | null;
  items: LineItem[];
  paymentTerms?: string | null;
  validUntil?: Date | null;
  terms?: string | null;
  createdAt: Date;
}

export function proposalPdf(
  proposal: ProposalData,
  recipient: {
    name: string;
    company?: string | null;
    email?: string | null;
    country?: string | null;
  },
  settings: CompanySettingsData,
) {
  const dateFormat = settings.preferences?.dateFormat ?? "DD MMM YYYY";
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: `Proposal ${proposal.number}`, Author: settings.company?.name ?? "SAS3D" },
  });

  header(doc, settings, "Proposal", proposal.number);
  const top = doc.y;
  const left = party(
    doc,
    "Prepared for",
    [recipient.name, recipient.company, recipient.email, recipient.country],
    PAGE_MARGIN,
    top,
  );
  const right = party(
    doc,
    "Details",
    [
      `Date: ${formatDocDate(proposal.createdAt, dateFormat)}`,
      proposal.validUntil ? `Valid until: ${formatDocDate(proposal.validUntil, dateFormat)}` : null,
      `Currency: ${proposal.currency}`,
    ],
    320,
    top,
  );
  doc.y = Math.max(left, right) + 14;
  doc.x = PAGE_MARGIN;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(BRAND)
    .text(proposal.title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  section(doc, "Introduction", settings.documents?.proposal?.introduction);
  section(doc, "Overview", proposal.description);
  section(doc, "Scope of work", proposal.scope);
  bullets(doc, "Deliverables", proposal.deliverables);
  section(doc, "Technologies", proposal.technologies?.join(", "));
  section(doc, "Timeline", proposal.timeline);

  if (proposal.items.length) {
    ensureSpace(doc, 90);
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND).text("Pricing", PAGE_MARGIN, doc.y);
    itemsTable(doc, proposal.items, proposal.currency);
    totalsBlock(doc, proposal);
  }
  section(doc, "Payment terms", proposal.paymentTerms);
  section(doc, "Terms and conditions", proposal.terms);

  footers(
    doc,
    settings.documents?.proposal?.footer ||
      `${settings.company?.name ?? "SAS3D"}  ${settings.company?.website ?? ""}`,
  );
  return toBuffer(doc);
}

interface InvoiceData extends Totals {
  number: string;
  issueDate: Date;
  dueDate: Date;
  items: LineItem[];
  amountPaid?: number | null;
  amountDue?: number | null;
  paymentTerms?: string | null;
  notes?: string | null;
  status: string;
}

interface InvoiceClient {
  name: string;
  companyName?: string | null;
  email?: string | null;
  billingAddress?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  tax?: { idType?: string | null; idNumber?: string | null } | null;
}

export function invoicePdf(
  invoice: InvoiceData,
  client: InvoiceClient | null,
  settings: CompanySettingsData,
) {
  const dateFormat = settings.preferences?.dateFormat ?? "DD MMM YYYY";
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: `Invoice ${invoice.number}`, Author: settings.company?.name ?? "SAS3D" },
  });

  header(doc, settings, "Invoice", invoice.number);
  const address = client?.billingAddress;
  const top = doc.y;
  const left = party(
    doc,
    "Bill to",
    [
      client?.name,
      client?.companyName,
      address?.line1,
      address?.line2,
      [address?.city, address?.state, address?.postalCode].filter(Boolean).join(", "),
      address?.country,
      client?.email,
      client?.tax?.idNumber ? `${client.tax.idType || "Tax ID"}: ${client.tax.idNumber}` : null,
    ],
    PAGE_MARGIN,
    top,
  );
  const right = party(
    doc,
    "Details",
    [
      `Issue date: ${formatDocDate(invoice.issueDate, dateFormat)}`,
      `Due date: ${formatDocDate(invoice.dueDate, dateFormat)}`,
      `Currency: ${invoice.currency}`,
      `Status: ${invoice.status.replaceAll("_", " ")}`,
    ],
    320,
    top,
  );
  doc.y = Math.max(left, right) + 8;
  doc.x = PAGE_MARGIN;

  itemsTable(doc, invoice.items, invoice.currency);
  totalsBlock(doc, invoice, [
    { label: "Amount paid", value: invoice.amountPaid ?? 0 },
    { label: "Balance due", value: invoice.amountDue ?? 0 },
  ]);
  section(doc, "Payment terms", invoice.paymentTerms);
  section(doc, "Payment details", settings.documents?.invoice?.bankDetails);
  section(doc, "Notes", invoice.notes);

  footers(
    doc,
    settings.documents?.invoice?.footer ||
      `${settings.company?.name ?? "SAS3D"}  ${settings.company?.website ?? ""}`,
  );
  return toBuffer(doc);
}
