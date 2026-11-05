"use client";

import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Mail,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  buttonClass,
  Card,
  ConfirmationDialog,
  DetailList,
  Dropdown,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Tabs,
  useToast,
} from "@/components/ui";
import { SendEmailModal } from "@/features/shared/send-email-modal";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { api, downloadFile } from "@/services/api";
import type { Proposal, ProposalRevision } from "@/types";
import { bpToPercent, formatMoney } from "@/utils/money";

const INVALIDATE = ["/proposals", "/opportunities", "/leads", "/dashboard", "/activities"];

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const toast = useToast();
  const [tab, setTab] = useState("document");
  const [emailing, setEmailing] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "ACCEPTED" | "REJECTED" | null>(null);
  const { data: proposal, isLoading, error, refetch } = useApiQuery<Proposal>(`/proposals/${id}`);
  const { data: revisions } = useApiQuery<ProposalRevision[]>(
    tab === "revisions" ? `/proposals/${id}/revisions` : null,
  );

  const setStatus = useApiMutation<string>({
    request: (status) => api.post(`/proposals/${id}/status`, { status }),
    invalidate: INVALIDATE,
    onSuccess: () => setConfirm(null),
  });
  const duplicate = useApiMutation<void, { _id: string }>({
    request: () => api.post(`/proposals/${id}/duplicate`),
    invalidate: ["/proposals"],
    onSuccess: (copy) => router.push(`/proposals/${copy._id}`),
  });
  const remove = useApiMutation({
    request: () => api.delete(`/proposals/${id}`),
    invalidate: INVALIDATE,
    onSuccess: () => router.push("/proposals"),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !proposal) return <ErrorState error={error} onRetry={refetch} />;

  const write = can("proposal:write");
  const { status } = proposal;
  const sendable = ["DRAFT", "EXPIRED", "REJECTED"].includes(status);
  const open = ["SENT", "VIEWED"].includes(status);
  const recipient = proposal.client ?? proposal.lead;

  return (
    <>
      <PageHeader
        back={{ href: "/proposals", label: "Proposals" }}
        title={proposal.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{proposal.number}</span>
            <StatusBadge status={status} />
            <span>Revision {proposal.revision}</span>
          </span>
        }
        actions={
          <>
            <Button
              icon={<Download className="size-4" />}
              onClick={() =>
                downloadFile(`/proposals/${id}/pdf`, `${proposal.number}.pdf`).catch((e: Error) =>
                  toast.error(e.message),
                )
              }
            >
              Download PDF
            </Button>
            {write && status !== "ACCEPTED" && (
              <Link href={`/proposals/${id}/edit`} className={buttonClass()}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            )}
            {write && sendable && (
              <Button
                variant="primary"
                icon={<Mail className="size-4" />}
                onClick={() => setEmailing(true)}
              >
                Email to client
              </Button>
            )}
            {write && open && (
              <Button
                variant="primary"
                icon={<CheckCircle2 className="size-4" />}
                onClick={() => setConfirm("ACCEPTED")}
              >
                Mark accepted
              </Button>
            )}
            {write && (
              <Dropdown
                items={[
                  {
                    label: "Mark as sent (without email)",
                    icon: Send,
                    hidden: !sendable,
                    onClick: () => setStatus.mutate("SENT"),
                  },
                  {
                    label: "Mark as viewed",
                    icon: Eye,
                    hidden: status !== "SENT",
                    onClick: () => setStatus.mutate("VIEWED"),
                  },
                  {
                    label: "Mark as rejected",
                    icon: XCircle,
                    hidden: !open,
                    onClick: () => setConfirm("REJECTED"),
                  },
                  { label: "Duplicate", icon: Copy, onClick: () => duplicate.mutate() },
                  {
                    label: "Delete",
                    icon: Trash2,
                    danger: true,
                    hidden: status === "ACCEPTED",
                    onClick: () => setConfirm("delete"),
                  },
                ]}
              />
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padded={false} className="min-w-0 lg:col-span-2">
          <div className="px-2 pt-1">
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { key: "document", label: "Proposal" },
                { key: "revisions", label: "Revision history" },
              ]}
            />
          </div>
          {tab === "document" ? (
            <div className="space-y-5 p-4">
              {[
                ["Overview", proposal.description],
                ["Scope of work", proposal.scope],
                ["Timeline", proposal.timeline],
                ["Technologies", proposal.technologies.join(", ")],
              ].map(
                ([title, body]) =>
                  body && (
                    <div key={title}>
                      <h3 className="mb-1 text-xs text-ink-3">{title}</h3>
                      <p className="whitespace-pre-wrap">{body}</p>
                    </div>
                  ),
              )}
              {proposal.deliverables.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs text-ink-3">Deliverables</h3>
                  <ul className="list-disc pl-5">
                    {proposal.deliverables.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {proposal.items.length > 0 && (
                <div className="overflow-x-auto">
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
                      {proposal.items.map((item, index) => (
                        <tr key={index} className="border-b border-line">
                          <td className="py-2 pr-3">{item.description}</td>
                          <td className="text-right">{item.quantity}</td>
                          <td className="whitespace-nowrap text-right">
                            <span className="font-mono">
                              {formatMoney(item.unitPrice, proposal.currency)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            <span className="font-mono">
                              {formatMoney(item.amount, proposal.currency)}
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
                          {formatMoney(proposal.subtotal, proposal.currency)}
                        </span>
                      </dd>
                    </div>
                    {proposal.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-ink-2">Discount</dt>
                        <dd>
                          -
                          <span className="font-mono">
                            {formatMoney(proposal.discountAmount, proposal.currency)}
                          </span>
                        </dd>
                      </div>
                    )}
                    {proposal.taxRateBp > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-ink-2">
                          {proposal.taxLabel} ({bpToPercent(proposal.taxRateBp)}%)
                        </dt>
                        <dd>
                          <span className="font-mono">
                            {formatMoney(proposal.taxAmount, proposal.currency)}
                          </span>
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-line-strong pt-1 text-base font-semibold">
                      <dt>Total</dt>
                      <dd>
                        <span className="font-mono">
                          {formatMoney(proposal.total, proposal.currency)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {[
                ["Payment terms", proposal.paymentTerms],
                ["Terms and conditions", proposal.terms],
                ["Internal notes", proposal.notes],
              ].map(
                ([title, body]) =>
                  body && (
                    <div key={title}>
                      <h3 className="mb-1 text-xs text-ink-3">{title}</h3>
                      <p className="whitespace-pre-wrap">{body}</p>
                    </div>
                  ),
              )}
            </div>
          ) : !revisions?.length ? (
            <EmptyState
              title="No earlier revisions"
              description="Each saved edit keeps a copy of the previous version"
            />
          ) : (
            <ul className="divide-y divide-line">
              {revisions.map((revision) => (
                <li key={revision._id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      Revision {revision.revision}: {revision.snapshot.title}
                    </p>
                    <p className="text-xs text-ink-3">
                      Replaced by {revision.changedBy?.name} on{" "}
                      <span className="font-mono">{format.dateTime(revision.createdAt)}</span>
                    </p>
                  </div>
                  <span className="tabular">
                    <span className="font-mono">
                      {formatMoney(revision.snapshot.total, revision.snapshot.currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Details" className="self-start">
          <DetailList
            items={[
              {
                label: "For",
                value: proposal.client ? (
                  <Link
                    className="text-accent hover:underline"
                    href={`/clients/${proposal.client._id}`}
                  >
                    {proposal.client.name}
                  </Link>
                ) : (
                  proposal.lead && (
                    <Link
                      className="text-accent hover:underline"
                      href={`/leads/${proposal.lead._id}`}
                    >
                      {proposal.lead.fullName}
                    </Link>
                  )
                ),
              },
              {
                label: "Total",
                value: (
                  <span className="tabular font-medium">
                    <span className="font-mono">
                      {formatMoney(proposal.total, proposal.currency)}
                    </span>
                  </span>
                ),
              },
              { label: "Valid until", value: format.day(proposal.validUntil), mono: true },
              { label: "Sent", value: format.dateTime(proposal.sentAt), mono: true },
              {
                label: "Accepted",
                value: format.dateTime(proposal.acceptedAt),
                mono: true,
                hidden: !proposal.acceptedAt,
              },
              {
                label: "Rejected",
                value: format.dateTime(proposal.rejectedAt),
                mono: true,
                hidden: !proposal.rejectedAt,
              },
              { label: "Created by", value: proposal.createdBy?.name },
            ]}
          />
        </Card>
      </div>
      {emailing && (
        <SendEmailModal
          open
          onClose={() => setEmailing(false)}
          path={`/proposals/${id}/send`}
          defaultTo={recipient?.email}
          documentLabel={`proposal ${proposal.number}`}
          invalidate={INVALIDATE}
        />
      )}
      <ConfirmationDialog
        open={confirm === "ACCEPTED"}
        onClose={() => setConfirm(null)}
        onConfirm={() => setStatus.mutate("ACCEPTED")}
        loading={setStatus.isPending}
        confirmLabel="Mark accepted"
        title="Mark this proposal accepted?"
        message="This locks the proposal and moves its linked opportunity to Won."
      />
      <ConfirmationDialog
        open={confirm === "REJECTED"}
        onClose={() => setConfirm(null)}
        onConfirm={() => setStatus.mutate("REJECTED")}
        loading={setStatus.isPending}
        danger
        confirmLabel="Mark rejected"
        title="Mark this proposal rejected?"
        message="You can still revise and resend it later."
      />
      <ConfirmationDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        confirmLabel="Delete"
        title="Delete this proposal?"
        message={`${proposal.number} will be removed from lists.`}
      />
    </>
  );
}
