"use client";

import { Archive, ArrowRightLeft, FileText, Pencil, UserCheck } from "lucide-react";
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
  ErrorState,
  ExternalLink,
  FormField,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
  UserChip,
} from "@/components/ui";
import { LeadForm } from "@/features/leads/lead-form";
import { ConvertDialog, LostReasonDialog, useMoveStage } from "@/features/pipeline/stage-dialogs";
import { ActivityTimeline } from "@/features/shared/activity-timeline";
import { AttachmentsPanel } from "@/features/shared/attachments-panel";
import { RelatedTasks } from "@/features/tasks/related-tasks";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label, PIPELINE_STAGES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Lead } from "@/types";
import { formatMoney } from "@/utils/money";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [wonPrompt, setWonPrompt] = useState(false);
  const { data: lead, isLoading, error, refetch } = useApiQuery<Lead>(`/leads/${id}`);

  const move = useMoveStage();
  const archive = useApiMutation({
    request: () => api.delete(`/leads/${id}`),
    invalidate: ["/leads", "/opportunities", "/dashboard"],
    onSuccess: () => router.push("/leads"),
  });
  const convert = useApiMutation<void, { client: { _id: string } }>({
    request: () => api.post(`/leads/${id}/convert`),
    invalidate: ["/leads", "/clients", "/opportunities", "/dashboard", "/activities"],
    onSuccess: (result) => router.push(`/clients/${result.client._id}`),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !lead) return <ErrorState error={error} onRetry={refetch} />;

  const oppId = lead.opportunity?._id;
  const changeStage = (to: string) => {
    if (!oppId) return;
    if (to === "LOST") return setLostOpen(true);
    move.mutate(
      { id: oppId, to },
      {
        onSuccess: () => {
          if (to === "WON") setWonPrompt(true);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        back={{ href: "/leads", label: "Leads" }}
        title={lead.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {lead.companyName}
            <StatusBadge status={lead.status} />
            <StatusBadge status={lead.priority} />
            {lead.archivedAt && <StatusBadge status="ARCHIVED" />}
          </span>
        }
        actions={
          !lead.archivedAt && (
            <>
              {can("proposal:write") && (
                <Link href={`/proposals/new?lead=${lead._id}`} className={buttonClass()}>
                  <FileText className="size-4" aria-hidden />
                  Create proposal
                </Link>
              )}
              {can("lead:write") && (
                <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {can("lead:write") && can("client:write") && !lead.convertedClient && (
                <Button
                  variant="primary"
                  icon={<UserCheck className="size-4" />}
                  onClick={() => setConfirmConvert(true)}
                >
                  Convert to client
                </Button>
              )}
              {can("lead:write") && (
                <Dropdown
                  items={[
                    {
                      label: "Archive",
                      icon: Archive,
                      danger: true,
                      onClick: () => setArchiving(true),
                    },
                  ]}
                />
              )}
            </>
          )
        }
      />
      {lead.convertedClient && (
        <p className="mb-4 rounded-lg bg-good-soft px-3 py-2 text-[13px] text-good">
          Converted to client{" "}
          <Link className="font-medium underline" href={`/clients/${lead.convertedClient._id}`}>
            {lead.convertedClient.name}
          </Link>
          .
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card padded={false}>
            <div className="px-2 pt-1">
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "communication", label: "Communication" },
                  { key: "tasks", label: "Follow-ups" },
                  { key: "activity", label: "Activity" },
                  { key: "files", label: "Files" },
                ]}
              />
            </div>
            {tab === "overview" && (
              <div className="space-y-5 p-4">
                <DetailList
                  items={[
                    {
                      label: "Email",
                      value: lead.email && (
                        <a className="text-accent hover:underline" href={`mailto:${lead.email}`}>
                          {lead.email}
                        </a>
                      ),
                    },
                    { label: "Phone", value: lead.phone },
                    { label: "WhatsApp", value: lead.whatsapp },
                    {
                      label: "Location",
                      value: [lead.city, lead.state, lead.country].filter(Boolean).join(", "),
                    },
                    { label: "Timezone", value: lead.timezone },
                    { label: "Website", value: <ExternalLink href={lead.website} /> },
                    { label: "LinkedIn", value: <ExternalLink href={lead.linkedinUrl} /> },
                    { label: "Source", value: label(lead.source) },
                    {
                      label: "Interested services",
                      value: lead.interestedServices.map((s) => s.name).join(", "),
                    },
                  ]}
                />
                {[
                  ["Description", lead.description],
                  ["Requirements", lead.requirements],
                  ["Internal notes", lead.internalNotes],
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
            )}
            {tab === "communication" && (
              <ActivityTimeline
                relation={{ lead: lead._id }}
                kind="COMMUNICATION"
                timezone={lead.timezone}
              />
            )}
            {tab === "tasks" && (
              <RelatedTasks
                relation={{ lead: lead._id }}
                defaultTitle={`Follow up with ${lead.fullName}`}
              />
            )}
            {tab === "activity" && <ActivityTimeline relation={{ lead: lead._id }} kind="SYSTEM" />}
            {tab === "files" && <AttachmentsPanel entityType="LEAD" entityId={lead._id} />}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Pipeline">
            <div className="space-y-3">
              {can("opportunity:write") && oppId && !lead.archivedAt ? (
                <FormField label="Stage">
                  {(f) => (
                    <Select
                      {...f}
                      value={lead.status}
                      disabled={move.isPending}
                      onChange={(e) => changeStage(e.target.value)}
                      options={toOptions(PIPELINE_STAGES)}
                    />
                  )}
                </FormField>
              ) : (
                <StatusBadge status={lead.status} />
              )}
              {lead.opportunity?.lostReason && (
                <p className="text-[13px] text-ink-2">Lost reason: {lead.opportunity.lostReason}</p>
              )}
              {lead.status === "WON" &&
                oppId &&
                !lead.opportunity?.project &&
                can("opportunity:convert") && (
                  <Button
                    className="w-full"
                    icon={<ArrowRightLeft className="size-4" />}
                    onClick={() => setWonPrompt(true)}
                  >
                    Convert to client and project
                  </Button>
                )}
              {lead.opportunity?.project && (
                <Link
                  className="block text-[13px] text-accent hover:underline"
                  href={`/projects/${lead.opportunity.project}`}
                >
                  View project
                </Link>
              )}
            </div>
          </Card>
          <Card title="Details">
            <DetailList
              items={[
                {
                  label: "Estimated budget",
                  value: lead.estimatedBudget
                    ? formatMoney(lead.estimatedBudget, lead.budgetCurrency)
                    : "",
                },
                { label: "Assigned to", value: <UserChip user={lead.assignedTo} /> },
                { label: "Created", value: format.date(lead.createdAt) },
                {
                  label: "Last contacted",
                  value: format.dateTime(lead.lastContactedAt, lead.timezone),
                },
                {
                  label: "Next follow-up",
                  value: format.dateTime(lead.nextFollowUpAt, lead.timezone),
                },
              ]}
            />
            {lead.timezone && lead.nextFollowUpAt && (
              <p className="mt-2 text-xs text-ink-3">
                Times shown in the lead&apos;s zone ({lead.timezone}).
              </p>
            )}
          </Card>
        </div>
      </div>
      <LeadForm open={editing} onClose={() => setEditing(false)} lead={lead} />
      <LostReasonDialog
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        loading={move.isPending}
        onSubmit={(lostReason) =>
          oppId &&
          move.mutate(
            { id: oppId, to: "LOST", lostReason },
            { onSuccess: () => setLostOpen(false) },
          )
        }
      />
      <ConvertDialog
        opportunity={
          wonPrompt && oppId ? { _id: oppId, title: lead.companyName || lead.fullName } : null
        }
        onClose={() => setWonPrompt(false)}
        onConverted={(r) =>
          router.push(r.projectId ? `/projects/${r.projectId}` : `/clients/${r.clientId}`)
        }
      />
      <ConfirmationDialog
        open={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        onConfirm={() => convert.mutate()}
        loading={convert.isPending}
        confirmLabel="Convert"
        title="Convert to client?"
        message={`A client will be created from ${lead.fullName}, or linked if one with this email already exists.`}
      />
      <ConfirmationDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        danger
        confirmLabel="Archive"
        title="Archive this lead?"
        message="The lead and its pipeline card will be hidden. You can restore it from the archived filter."
      />
    </>
  );
}
