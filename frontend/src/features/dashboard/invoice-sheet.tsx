import type { Dashboard } from "@/types";
import { formatMoney } from "@/utils/money";

type OpenInvoice = NonNullable<Dashboard["finance"]>["openInvoices"][number];

const SHEET = "absolute right-8 top-6 h-48 w-52 rounded-md";

/**
 * The thing the outstanding figure counts, drawn in code. It shows a real open invoice, and a
 * blank sheet when there is none, so it never displays made-up numbers.
 */
export function InvoiceSheet({ invoice }: { invoice?: OpenInvoice }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-72 max-sm:hidden" aria-hidden>
      <div className={`${SHEET} rotate-[5deg] bg-paper-back shadow-sheet`} />
      <div
        className={`${SHEET} -rotate-[4deg] bg-linear-to-b from-paper to-paper-back p-4 text-paper-ink shadow-sheet`}
      >
        <p className="text-xs font-medium">Invoice</p>
        {invoice ? (
          <>
            <p className="mt-1 font-mono text-xs text-paper-muted">{invoice.number}</p>
            <p className="mt-4 truncate text-xs text-paper-muted">{invoice.client?.name}</p>
            <p className="tabular mt-1 text-sm font-medium">
              {formatMoney(invoice.amountDue, invoice.currency)}
            </p>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-20 rounded-sm bg-paper-line" />
            <div className="h-1.5 w-28 rounded-sm bg-paper-line" />
            <div className="h-1.5 w-16 rounded-sm bg-paper-line" />
          </div>
        )}
        <div className="absolute inset-x-4 bottom-8 border-t border-paper-line" />
      </div>
    </div>
  );
}
