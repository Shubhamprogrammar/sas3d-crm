"use client";

import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "./use-debounce";

/** Shared page, search, sort and filter state for list screens. */
export function useListState<F extends Record<string, string>>(
  initialFilters: F,
  initialSort?: { sortBy: string; sortOrder: "asc" | "desc" },
  limit = 20,
) {
  const [page, setPage] = useState(1);
  const [search, setSearchValue] = useState("");
  const [filters, setFilters] = useState<F>(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const debouncedSearch = useDebounce(search);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: keyof F, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const toggleSort = useCallback((sortBy: string) => {
    setSort((current) => ({
      sortBy,
      sortOrder: current?.sortBy === sortBy && current.sortOrder === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }, []);

  const clear = useCallback(() => {
    setFilters(initialFilters);
    setSearchValue("");
    setPage(1);
    // Initial filters are constant for a screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(() => {
    const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    return {
      page,
      limit,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...active,
      ...(sort ?? {}),
    };
  }, [page, limit, debouncedSearch, filters, sort]);

  const hasFilters = Boolean(search) || Object.values(filters).some(Boolean);
  return {
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    sort,
    toggleSort,
    clear,
    params,
    hasFilters,
  };
}
