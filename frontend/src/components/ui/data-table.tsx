"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { LoadingSkeleton, ErrorState } from "./misc";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Field name to send when sorting by this column. */
  sortKey?: string;
  align?: "left" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  empty: ReactNode;
  onRowClick?: (row: T) => void;
  sort?: { sortBy: string; sortOrder: "asc" | "desc" };
  onSort?: (sortKey: string) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  sort,
  onSort,
}: DataTableProps<T>) {
  if (error && !rows.length) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows.length) return <LoadingSkeleton />;
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            {columns.map((column) => {
              const active = sort?.sortBy === column.sortKey;
              const SortIcon = !active
                ? ChevronsUpDown
                : sort?.sortOrder === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (sort?.sortOrder === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`whitespace-nowrap px-4 py-2.5 font-medium ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.sortKey && onSort ? (
                    <button
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"
                      onClick={() => onSort(column.sortKey as string)}
                    >
                      {column.header}
                      <SortIcon className="size-3" aria-hidden />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface-2" : ""}`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-2.5 ${column.align === "right" ? "tabular whitespace-nowrap text-right" : ""} ${column.className ?? ""}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
