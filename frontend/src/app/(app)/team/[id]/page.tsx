"use client";

import { Pencil, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  ConfirmationDialog,
  DetailList,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { MemberForm } from "@/features/team/member-form";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { api } from "@/services/api";
import type { TeamMemberDetail } from "@/types";

export default function TeamMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { can, me } = useMe();
  const format = useFormat();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { data: member, isLoading, error, refetch } = useApiQuery<TeamMemberDetail>(`/team/${id}`);
  const setStatus = useApiMutation<string>({
    request: (status) => api.post(`/team/${id}/status`, { status }),
    invalidate: ["/team"],
    onSuccess: () => setConfirming(false),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !member) return <ErrorState error={error} onRetry={refetch} />;

  const adminTarget = member.role === "SUPER_ADMIN" || member.role === "ADMIN";
  const manageable = can("team:write") && (me?.user.role === "SUPER_ADMIN" || !adminTarget);
  const active = member.status === "ACTIVE";
  return (
    <>
      <PageHeader
        back={{ href: "/team", label: "Team" }}
        title={member.name}
        description={
          <span className="flex items-center gap-2">
            {label(member.role)}
            <StatusBadge status={member.status} />
          </span>
        }
        actions={
          manageable && (
            <>
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              {member._id !== me?.user._id &&
                (active ? (
                  <Button icon={<UserX className="size-4" />} onClick={() => setConfirming(true)}>
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    icon={<UserCheck className="size-4" />}
                    loading={setStatus.isPending}
                    onClick={() => setStatus.mutate("ACTIVE")}
                  >
                    Activate
                  </Button>
                ))}
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={member.name} image={member.image} size="lg" />
            <div className="min-w-0">
              <p className="font-medium">{member.name}</p>
              <p className="truncate text-[13px] text-ink-2">{member.email}</p>
            </div>
          </div>
          <DetailList
            items={[
              { label: "Designation", value: member.designation },
              { label: "Phone", value: member.phone },
              { label: "Joined", value: format.day(member.joiningDate) },
              { label: "Skills", value: member.skills?.join(", ") },
            ]}
          />
        </Card>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-ink-3">Pending tasks</p>
              <p className="tabular mt-1 text-3xl font-medium">{member.stats.pendingTasks}</p>
            </Card>
            <Card>
              <p className="text-xs text-ink-3">Completed tasks</p>
              <p className="tabular mt-1 text-3xl font-medium">{member.stats.completedTasks}</p>
            </Card>
            <Card>
              <p className="text-xs text-ink-3">Completion rate</p>
              <p className="tabular mt-1 text-3xl font-medium">{member.stats.completionRate}%</p>
            </Card>
          </div>
          <Card title="Assigned projects" padded={false}>
            {member.projects.length ? (
              <ul className="divide-y divide-line">
                {member.projects.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link className="hover:underline" href={`/projects/${p._id}`}>
                      {p.name} <span className="font-mono text-xs text-ink-3">{p.code}</span>
                    </Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-ink-3">No projects assigned</p>
            )}
          </Card>
          <Card title="Open tasks" padded={false}>
            {member.tasks.length ? (
              <ul className="divide-y divide-line">
                {member.tasks.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-2">
                      {format.date(t.dueAt)}
                      <StatusBadge status={t.priority} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-ink-3">No open tasks</p>
            )}
          </Card>
          <Card title="Assigned leads" padded={false}>
            {member.leads.length ? (
              <ul className="divide-y divide-line">
                {member.leads.map((l) => (
                  <li key={l._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate">
                      {can("lead:read") ? (
                        <Link className="hover:underline" href={`/leads/${l._id}`}>
                          {l.fullName}
                        </Link>
                      ) : (
                        l.fullName
                      )}{" "}
                      <span className="text-xs text-ink-3">{l.companyName}</span>
                    </span>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-ink-3">No leads assigned</p>
            )}
          </Card>
        </div>
      </div>
      <MemberForm open={editing} onClose={() => setEditing(false)} member={member} />
      <ConfirmationDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => setStatus.mutate("INACTIVE")}
        loading={setStatus.isPending}
        danger
        confirmLabel="Deactivate"
        title={`Deactivate ${member.name}?`}
        message="They are signed out immediately and cannot sign in until reactivated. Their records are kept."
      />
    </>
  );
}
