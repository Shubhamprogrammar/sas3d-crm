"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Download, Mail, Pencil, Send, Trash2, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  buttonClass,
  Card,
  ConfirmationDialog,
  DatePicker,
  DetailList,
  Dropdown,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingSkeleton,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { SendEmailModal } from "@/features/shared/send-email-modal";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label, PAYMENT_METHODS, toOptions } from "@/lib/constants";
import { api, downloadFile } from "@/services/api";
import type { Invoice, Payment } from "@/types";
import { todayInput } from "@/utils/format";
import { bpToPercent, formatMoney, fromMinor, isValidAmount, toMinor } from "@/utils/money";

const INVALIDATE = [
  "/invoices",
  "/payments",
  "/dashboard",
  "/activities",
  "/clients",
  "/reports",
  "/notifications",
];

const paymentSchema = z.object({
  amount: z
    .string()
    .refine((v) => isValidAmount(v) && toMinor(v) > 0, "Enter an amount above zero"),
  paymentDate: z.string().min(1, "Required"),
  method: z.enum(PAYMENT_METHODS),
  transactionReference: z.string(),
  notes: z.string(),
});
type PaymentValues = z.infer<typeof paymentSchema>;

function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: fromMinor(invoice.amountDue),
      paymentDate: todayInput(),
      method: "BANK_TRANSFER",
      transactionReference: "",
      notes: "",
    },
  });
  const save = useApiMutation<PaymentValues>({
    request: (values) =>
      api.post("/payments", {
        ...values,
        invoice: invoice._id,
        currency: invoice.currency,
        amount: toMinor(values.amount),
      }),
    invalidate: INVALIDATE,
    onSuccess: onClose,
    onError: (error) => applyServerErrors(error, setError),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      description={`Outstanding balance: ${formatMoney(invoice.amountDue, invoice.currency)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="payment-form" loading={save.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <form
        id="payment-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="grid gap-3 sm:grid-cols-2"
      >
        <FormField label={`Amount (${invoice.currency})`} required error={errors.amount?.message}>
          {(f) => <Input inputMode="decimal" {...f} {...register("amount")} />}
        </FormField>
        <FormField label="Payment date" required error={errors.paymentDate?.message}>
          {(f) => <DatePicker {...f} {...register("paymentDate")} />}
        </FormField>
        <FormField label="Method" required>
          {(f) => <Select {...f} {...register("method")} options={toOptions(PAYMENT_METHODS)} />}
        </FormField>
        <FormField label="Transaction reference" hint="Prevents recording the same payment twice">
          {(f) => <Input {...f} {...register("transactionReference")} />}
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          {(f) => <Textarea {...f} {...register("notes")} />}
        </FormField>
      </form>
    </Modal>
  );
}

function ReasonModal({
  title,
  description,
  action,
  danger,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  action: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={!reason.trim()}
            loading={loading}
            onClick={() => onSubmit(reason.trim())}
          >
            {action}
          </Button>
        </>
      }
    >
      <FormField label="Reason" required>
        {(f) => <Textarea {...f} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </FormField>
    </Modal>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const { data: invoice, isLoading, error, refetch } = useApiQuery<Invoice>(`/invoices/${id}`);

  const issue = useApiMutation({
    request: () => api.post(`/invoices/${id}/issue`),
    invalidate: INVALIDATE,
    onSuccess: () => setIssuing(false),
  });
  const cancel = useApiMutation<string>({
    request: (reason) => api.post(`/invoices/${id}/cancel`, { reason }),
    invalidate: INVALIDATE,
    onSuccess: () => setCancelling(false),
  });
  const remove = useApiMutation({
    request: () => api.delete(`/invoices/${id}`),
    invalidate: INVALIDATE,
    onSuccess: () => router.push("/invoices"),
  });
  const voidPayment = useApiMutation<string>({
    request: (reason) => api.post(`/payments/${voiding?._id}/void`, { reason }),
    invalidate: INVALIDATE,
    onSuccess: () => setVoiding(null),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !invoice) return <ErrorState error={error} onRetry={refetch} />;

  const write = can("invoice:write");
  const isDraft = invoice.status === "DRAFT";
  const isOpen = ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);

  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={invoice.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="hover:underline" href={`/clients/${invoice.client._id}`}>
              {invoice.client.name}
            </Link>
            <StatusBadge status={invoice.status} />
          </span>
        }
        actions={
          <>
            <Button
              icon={<Download className="size-4" />}
              onClick={() =>
                downloadFile(`/invoices/${id}/pdf`, `${invoice.number}.pdf`).catch((e: Error) =>
                  toast.error(e.message),
                )
              }
            >
              Download PDF
            </Button>
            {write && isDraft && (
              <Link href={`/invoices/${id}/edit`} className={buttonClass()}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            )}
            {write && isDraft && (
              <Button
                variant="primary"
                icon={<Send className="size-4" />}
                onClick={() => setIssuing(true)}
              >
                Issue invoice
              </Button>
            )}
            {can("payment:write") && isOpen && (
              <Button
                variant="primary"
                icon={<Wallet className="size-4" />}
                onClick={() => setPaying(true)}
              >
                Record payment
              </Button>
            )}
            {write && invoice.status !== "CANCELLED" && (
              <Dropdown
                items={[
                  {
                    label: isDraft ? "Email and issue" : "Email to client",
                    icon: Mail,
                    onClick: () => setEmailing(true),
                  },
                  {
                    label: "Delete draft",
                    icon: Trash2,
                    danger: true,
                    hidden: !isDraft,
                    onClick: () => setDeleting(true),
                  },
                  {
                    label: "Cancel invoice",
                    icon: Ban,
                    danger: true,
                    hidden: isDraft || invoice.status === "PAID",
                    onClick: () => setCancelling(true),
                  },
                ]}
              />
            )}
          </>
        }
      />
      {invoice.status === "CANCELLED" && (
        <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          Cancelled: {invoice.cancelReason}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card title="Line items" padded={false}>
            <div className="overflow-x-auto p-4">
              <table className="tabular w-full text-[13px]">
                <thead className="border-b border-line text-xs text-ink-3">
                  <tr>
                    <th className="py-2 text-left font-medium">Description</th>
                    <th className="text-right font-medium">Qty</th>
                    <th className="text-right font-medium">Unit price</th>
                    <th className="text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={index} className="border-b border-line">
                      <td className="py-2 pr-3">{item.description}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="whitespace-nowrap text-right">
                        <span className="font-mono">
                          {formatMoney(item.unitPrice, invoice.currency)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="font-mono">
                          {formatMoney(item.amount, invoice.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="tabular ml-auto mt-3 w-72 max-w-full space-y-1 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Subtotal</dt>
                  <dd>
                    <span className="font-mono">
                      {formatMoney(invoice.subtotal, invoice.currency)}
                    </span>
                  </dd>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Discount</dt>
                    <dd>
                      -
                      <span className="font-mono">
                        {formatMoney(invoice.discountAmount, invoice.currency)}
                      </span>
                    </dd>
                  </div>
                )}
                {invoice.taxRateBp > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-2">
                      {invoice.taxLabel} ({bpToPercent(invoice.taxRateBp)}%)
                    </dt>
                    <dd>
                      <span className="font-mono">
                        {formatMoney(invoice.taxAmount, invoice.currency)}
                      </span>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line-strong pt-1 font-semibold">
                  <dt>Total</dt>
                  <dd>
                    <span className="font-mono">
                      {formatMoney(invoice.total, invoice.currency)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Amount paid</dt>
                  <dd>
                    <span className="font-mono">
                      {formatMoney(invoice.amountPaid, invoice.currency)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line-strong pt-1 text-base font-semibold">
                  <dt>Balance due</dt>
                  <dd data-testid="balance-due">
                    <span className="font-mono">
                      {formatMoney(invoice.amountDue, invoice.currency)}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
          <Card title="Payment history" padded={false}>
            {!invoice.payments?.length ? (
              <EmptyState icon={Wallet} title="No payments recorded" />
            ) : (
              <ul className="divide-y divide-line">
                {invoice.payments.map((payment) => (
                  <li key={payment._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`tabular font-medium ${payment.voidedAt ? "text-ink-3 line-through" : ""}`}
                      >
                        <span className="font-mono">
                          {formatMoney(payment.amount, payment.currency)}
                        </span>
                      </p>
                      <p className="text-xs text-ink-3">
                        <span className="font-mono">{format.day(payment.paymentDate)}</span> ·{" "}
                        {label(payment.method)}
                        {payment.transactionReference
                          ? ` · ${payment.transactionReference}`
                          : ""} · {payment.recordedBy?.name}
                      </p>
                      {payment.notes && <p className="text-[13px] text-ink-2">{payment.notes}</p>}
                      {payment.voidedAt && (
                        <p className="text-xs text-bad">Voided: {payment.voidReason}</p>
                      )}
                    </div>
                    {payment.voidedAt ? (
                      <StatusBadge status="VOIDED" tone="bad" />
                    ) : (
                      can("payment:write") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Undo2 className="size-4" />}
                          onClick={() => setVoiding(payment)}
                        >
                          Void
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Details" className="self-start">
          <DetailList
            items={[
              { label: "Client", value: invoice.client.companyName || invoice.client.name },
              {
                label: "Project",
                value: invoice.project && (
                  <Link
                    className="text-accent hover:underline"
                    href={`/projects/${invoice.project._id}`}
                  >
                    {invoice.project.name}
                  </Link>
                ),
              },
              { label: "Issue date", value: format.day(invoice.issueDate), mono: true },
              { label: "Due date", value: format.day(invoice.dueDate), mono: true },
              { label: "Sent", value: format.dateTime(invoice.sentAt), mono: true },
              { label: "Currency", value: invoice.currency },
            ]}
          />
          {invoice.paymentTerms && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs text-ink-3">Payment terms</h3>
              <p className="whitespace-pre-wrap">{invoice.paymentTerms}</p>
            </div>
          )}
          {invoice.notes && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs text-ink-3">Notes</h3>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </Card>
      </div>
      {paying && <PaymentModal invoice={invoice} onClose={() => setPaying(false)} />}
      {emailing && (
        <SendEmailModal
          open
          onClose={() => setEmailing(false)}
          path={`/invoices/${id}/send`}
          defaultTo={invoice.client.email}
          documentLabel={`invoice ${invoice.number}`}
          invalidate={INVALIDATE}
        />
      )}
      {cancelling && (
        <ReasonModal
          title="Cancel invoice"
          description="The invoice is kept on record as cancelled"
          action="Cancel invoice"
          danger
          loading={cancel.isPending}
          onClose={() => setCancelling(false)}
          onSubmit={(reason) => cancel.mutate(reason)}
        />
      )}
      {voiding && (
        <ReasonModal
          title="Void payment"
          description={`${formatMoney(voiding.amount, voiding.currency)} will be returned to the invoice balance. The record is kept.`}
          action="Void payment"
          danger
          loading={voidPayment.isPending}
          onClose={() => setVoiding(null)}
          onSubmit={(reason) => voidPayment.mutate(reason)}
        />
      )}
      <ConfirmationDialog
        open={issuing}
        onClose={() => setIssuing(false)}
        onConfirm={() => issue.mutate()}
        loading={issue.isPending}
        confirmLabel="Issue invoice"
        title="Issue this invoice?"
        message="It will be marked as sent, counted in revenue reports and locked from editing. No email is sent by this action."
      />
      <ConfirmationDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        confirmLabel="Delete draft"
        title="Delete this draft?"
        message={`Draft ${invoice.number} will be removed.`}
      />
    </>
  );
}
