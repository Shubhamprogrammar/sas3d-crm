"use client";

import { useMemo } from "react";
import { useApiList } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { Client, Project, Service, TeamMember } from "@/types";

export function useTeamOptions() {
  const { can } = useMe();
  const { items } = useApiList<TeamMember>(can("team:read") ? "/team" : null, {
    status: "ACTIVE",
    limit: 200,
  });
  return useMemo(
    () => items.map((member) => ({ value: member._id, label: member.name, role: member.role })),
    [items],
  );
}

export function useServiceOptions(activeOnly = true) {
  const { items } = useApiList<Service>("/services", {
    limit: 200,
    ...(activeOnly ? { active: "true" } : {}),
  });
  return {
    services: items,
    options: useMemo(() => items.map((s) => ({ value: s._id, label: s.name })), [items]),
  };
}

export function useClientOptions() {
  const { can } = useMe();
  const { items } = useApiList<Client>(can("client:read") ? "/clients" : null, {
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
  });
  return useMemo(
    () =>
      items.map((c) => ({
        value: c._id,
        label: c.companyName ? `${c.name} (${c.companyName})` : c.name,
        currency: "",
      })),
    [items],
  );
}

export function useProjectOptions(client?: string) {
  const { can } = useMe();
  const { items } = useApiList<Project>(can("project:read") ? "/projects" : null, {
    limit: 100,
    ...(client ? { client } : {}),
  });
  return useMemo(() => items.map((p) => ({ value: p._id, label: `${p.code} ${p.name}` })), [items]);
}
