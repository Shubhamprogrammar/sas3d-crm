"use client";

import { Plus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { MemberForm } from "@/features/team/member-form";
import { useApiList } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { label, ROLES, toOptions } from "@/lib/constants";
import type { TeamMember } from "@/types";

export default function TeamPage() {
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const list = useListState({ role: "", status: "" });
  const { items, meta, isLoading, error, refetch } = useApiList<TeamMember>("/team", list.params);
  const [creating, setCreating] = useState(false);
  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Name",
      render: (m) => (
        <div className="flex min-w-48 items-center gap-2.5">
          <Avatar name={m.name} image={m.image} />
          <div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-ink-3">{m.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (m) => label(m.role) },
    { key: "designation", header: "Designation", render: (m) => m.designation },
    {
      key: "skills",
      header: "Skills",
      render: (m) => <span className="line-clamp-1">{m.skills?.join(", ")}</span>,
    },
    {
      key: "joined",
      header: "Joined",
      render: (m) => <span className="whitespace-nowrap">{format.day(m.joiningDate)}</span>,
    },
    { key: "status", header: "Status", render: (m) => <StatusBadge status={m.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="Team"
        actions={
          can("team:write") && (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setCreating(true)}
            >
              New member
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_200px_160px]">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search team" />
          <Select
            aria-label="Role"
            value={list.filters.role}
            onChange={(e) => list.setFilter("role", e.target.value)}
            options={toOptions(ROLES)}
            placeholder="All roles"
          />
          <Select
            aria-label="Status"
            value={list.filters.status}
            onChange={(e) => list.setFilter("status", e.target.value)}
            options={toOptions(["ACTIVE", "INACTIVE"])}
            placeholder="Any status"
          />
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(m) => m._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(m) => router.push(`/team/${m._id}`)}
          empty={<EmptyState icon={UsersRound} title="No team members found" />}
        />
        {meta && (
          <Pagination
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            onChange={list.setPage}
          />
        )}
      </Card>
      <MemberForm open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
