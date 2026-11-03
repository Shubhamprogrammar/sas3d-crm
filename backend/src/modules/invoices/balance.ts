import type { InvoiceStatus } from "../../config/constants.js";

/** The one place invoice status is decided from its balance. Pure, so it is unit-tested directly. */
export function deriveInvoiceStatus(invoice: {
  status: InvoiceStatus;
  total: number;
  amountPaid: number;
  pastDue: boolean;
}): InvoiceStatus {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return invoice.status;
  if (invoice.amountPaid >= invoice.total) return "PAID";
  if (invoice.pastDue) return "OVERDUE";
  return invoice.amountPaid > 0 ? "PARTIALLY_PAID" : "SENT";
}
