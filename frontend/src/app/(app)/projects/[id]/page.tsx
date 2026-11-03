"use client";

import { Archive, Pencil, Receipt } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Button,
  buttonClass,
  Card,
  ConfirmationDialog,
  DetailList,
  Dropdown,
  ErrorState,
  ExternalLink,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  StatusBadge,
  Tabs,
  UserChip,
} from "@/components/ui";
import { MilestonesPanel } from "@/features/projects/milestones-panel";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectTasksPanel } from "@/features/projects/project-tasks-panel";
import { UpdatesPanel } from "@/features/projects/updates-panel";
import { ActivityTimeline } from "@/features/shared/activity-timeline";
import { AttachmentsPanel } from "@/features/shared/attachments-panel";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { api } from "@/services/api";
import type { Project } from "@/types";
import { formatMoney } from "@/utils/money";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can, me } = useMe();
  const format = useFormat();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { data: project, isLoading, error, refetch } = useApiQuery<Project>(`/projects/${id}`);
  const archive = useApiMutation({
    request: () => api.delete(`/projects/${id}`),
    invalidate: ["/projects", "/dashboard"],
    onSuccess: () => router.push("/projects"),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !project) return <ErrorState error={error} onRetry={refetch} />;

  const role = me?.user.role;
  const canManage =
    can("project:write") &&
    (role === "SUPER_ADMIN" || role === "ADMIN" || project.projectManager?._id === me?.user._id);
  const overdue =
    project.expectedDeliveryDate &&
    new Date(project.expectedDeliveryDate) < new Date() &&
    !["COMPLETED", "CANCELLED", "DELIVERED"].includes(project.status);

  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {project.code}
            <StatusBadge status={project.status} />
            <StatusBadge status={project.priority} />
            {overdue && <StatusBadge status="Past delivery date" tone="bad" />}
          </span>
        }
        actions={
          <>
            {can("invoice:write") && (
              <Link
                href={`/invoices/new?client=${project.client._id}&project=${project._id}`}
                className={buttonClass()}
              >
                <Receipt className="size-4" aria-hidden />
                New invoice
              </Link>
            )}
            {canManage && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can("project:delete") && (
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
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padded={false} className="min-w-0 lg:col-span-2">
          <div className="px-2 pt-1">
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { key: "overview", label: "Overview" },
                { key: "milestones", label: "Milestones", count: project.milestoneCount },
                { key: "tasks", label: "Tasks", count: project.taskCount },
                { key: "updates", label: "Updates and feedback" },
                { key: "files", label: "Files" },
                { key: "activity", label: "Activity" },
              ]}
            />
          </div>
          {tab === "overview" && (
            <div className="space-y-4 p-4">
              {project.description && <p className="whitespace-pre-wrap">{project.description}</p>}
              <DetailList
                items={[
                  { label: "GitHub repository", value: <ExternalLink href={project.githubUrl} /> },
                  { label: "Staging", value: <ExternalLink href={project.stagingUrl} /> },
                  { label: "Production", value: <ExternalLink href={project.productionUrl} /> },
                  {
                    label: "Documentation",
                    value: <ExternalLink href={project.documentationUrl} />,
                  },
                ]}
              />
              {project.internalNotes && (
                <div>
                  <h3 className="mb-1 text-xs text-ink-3">Internal notes</h3>
                  <p className="whitespace-pre-wrap">{project.internalNotes}</p>
                </div>
              )}
            </div>
          )}
          {tab === "milestones" && <MilestonesPanel project={id} canManage={canManage} />}
          {tab === "tasks" && <ProjectTasksPanel project={project} canManage={canManage} />}
          {tab === "updates" && <UpdatesPanel project={id} />}
          {tab === "files" && <AttachmentsPanel entityType="PROJECT" entityId={id} />}
          {tab === "activity" && <ActivityTimeline relation={{ project: id }} />}
        </Card>
        <div className="space-y-4">
          <Card title="Progress">
            <ProgressBar value={project.progress} />
            <p className="mt-2 text-xs text-ink-2">
              {project.milestonesCompleted} of {project.milestoneCount} milestones and{" "}
              {project.tasksCompleted} of {project.taskCount} tasks complete
            </p>
          </Card>
          <Card title="Details">
            <DetailList
              items={[
                {
                  label: "Client",
                  value: can("client:read") ? (
                    <Link
                      className="text-accent hover:underline"
                      href={`/clients/${project.client._id}`}
                    >
                      {project.client.name}
                    </Link>
                  ) : (
                    project.client.name
                  ),
                },
                { label: "Category", value: label(project.category) },
                {
                  label: "Budget",
                  value: project.budget ? formatMoney(project.budget, project.currency) : "",
                  hidden: role === "DEVELOPER",
                },
                { label: "Start date", value: format.day(project.startDate) },
                { label: "Expected delivery", value: format.day(project.expectedDeliveryDate) },
                {
                  label: "Completed",
                  value: format.day(project.actualCompletionDate),
                  hidden: !project.actualCompletionDate,
                },
                { label: "Project manager", value: <UserChip user={project.projectManager} /> },
              ]}
            />
            <h3 className="mb-1.5 mt-4 text-xs text-ink-3">Team</h3>
            {project.team.length ? (
              <ul className="space-y-1.5">
                {project.team.map((member) => (
                  <li key={member._id} className="flex items-center gap-2 text-[13px]">
                    <Avatar name={member.name} image={member.image} size="sm" />
                    {member.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-3">No team members assigned</p>
            )}
          </Card>
        </div>
      </div>
      <ProjectForm open={editing} onClose={() => setEditing(false)} project={project} />
      <ConfirmationDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        danger
        confirmLabel="Archive"
        title="Archive this project?"
        message="It will be hidden from lists. Invoices linked to it are kept."
      />
    </>
  );
}
