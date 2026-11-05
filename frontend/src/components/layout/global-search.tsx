"use client";

import {
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  Receipt,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui";
import { useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import type { SearchResult } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  lead: Users,
  client: Building2,
  project: FolderKanban,
  proposal: FileText,
  invoice: Receipt,
  task: CheckSquare,
};

export function GlobalSearch() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const term = useDebounce(value.trim());
  const { data, isFetching } = useApiQuery<SearchResult[]>(term.length >= 2 ? "/search" : null, {
    q: term,
  });
  const results = term.length >= 2 ? (data ?? []) : [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) =>
      !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const go = (result: SearchResult) => {
    setOpen(false);
    setValue("");
    router.push(result.href);
  };

  return (
    <div ref={root} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-2.5 top-2 size-4 text-ink-3"
        aria-hidden
      />
      <input
        ref={input}
        role="combobox"
        aria-expanded={open && term.length >= 2}
        aria-controls="global-search-results"
        aria-label="Search leads, clients, projects, proposals, invoices and tasks"
        placeholder="Search"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          }
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results[cursor]) go(results[cursor]);
        }}
        className="h-8 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-[13px] placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none"
      />
      {open && term.length >= 2 && (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute z-40 mt-1 max-h-96 w-full min-w-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          {!results.length && (
            <li className="px-3 py-4 text-center text-[13px] text-ink-2">
              {isFetching ? "Searching" : "No matches"}
            </li>
          )}
          {results.map((result, index) => {
            const Icon = ICONS[result.type] ?? Search;
            return (
              <li
                key={`${result.type}-${result.id}`}
                role="option"
                aria-selected={index === cursor}
              >
                <button
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(result)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ${index === cursor ? "bg-surface-2" : ""}`}
                >
                  <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{result.title}</span>
                    <span className="block truncate text-xs capitalize text-ink-3">
                      {result.type}
                      {result.subtitle ? ` · ${result.subtitle}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={result.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
