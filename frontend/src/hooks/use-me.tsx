"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/services/api";
import type { Me, Preferences } from "@/types";
import { makeFormatters } from "@/utils/format";

interface MeContextValue {
  me: Me | undefined;
  isLoading: boolean;
  /** Hides UI the user cannot use. The backend enforces the same rule on every request. */
  can: (permission: string) => boolean;
  preferences: Preferences;
}

const DEFAULT_PREFERENCES: Preferences = {
  defaultCurrency: "INR",
  timezone: "Asia/Kolkata",
  dateFormat: "DD MMM YYYY",
  timeFormat: "12h",
  theme: "light",
};

const MeContext = createContext<MeContextValue | null>(null);

export const ME_PATH = "/me";

export function MeProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: [ME_PATH, {}],
    queryFn: async () => (await api.get<Me>(ME_PATH)).data,
    staleTime: 60_000,
  });
  const value = useMemo<MeContextValue>(() => {
    const permissions = new Set(query.data?.permissions ?? []);
    return {
      me: query.data,
      isLoading: query.isLoading,
      can: (permission) => permissions.has(permission),
      preferences: query.data?.preferences ?? DEFAULT_PREFERENCES,
    };
  }, [query.data, query.isLoading]);
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe must be used inside MeProvider");
  return value;
}

export function useFormat() {
  const { preferences } = useMe();
  return useMemo(() => makeFormatters(preferences), [preferences]);
}
