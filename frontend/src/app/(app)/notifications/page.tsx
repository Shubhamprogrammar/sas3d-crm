"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  Pagination,
  Tabs,
} from "@/components/ui";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useFormat } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { Notification } from "@/types";

export default function NotificationsPage() {
  const router = useRouter();
  const format = useFormat();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const { items, meta, isLoading, error, refetch } = useApiList<Notification>("/notifications", {
    page,
    limit: 25,
    ...(tab === "unread" ? { unread: "true" } : {}),
  });
  const markRead = useApiMutation<string>({
    request: (id) => api.post(`/notifications/${id}/read`),
    invalidate: ["/notifications"],
    toastSuccess: false,
  });
  const markAll = useApiMutation({
    request: () => api.post("/notifications/read-all"),
    invalidate: ["/notifications"],
  });
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button onClick={() => markAll.mutate()} loading={markAll.isPending}>
            Mark all as read
          </Button>
        }
      />
      <Card padded={false}>
        <div className="px-2 pt-1">
          <Tabs
            active={tab}
            onChange={(key) => {
              setTab(key);
              setPage(1);
            }}
            tabs={[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
            ]}
          />
        </div>
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !items.length ? (
          <EmptyState
            icon={Bell}
            title={tab === "unread" ? "You are all caught up" : "No notifications yet"}
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item._id}>
                <button
                  className="flex w-full cursor-pointer gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  onClick={() => {
                    if (!item.readAt) markRead.mutate(item._id);
                    if (item.link) router.push(item.link);
                  }}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-accent"}`}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {item.title}
                      {!item.readAt && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="block text-[13px] text-ink-2">{item.message}</span>
                    <span className="block text-xs text-ink-3">
                      <span className="font-mono">{format.dateTime(item.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {meta && meta.pages > 1 && (
          <Pagination page={meta.page} pages={meta.pages} total={meta.total} onChange={setPage} />
        )}
      </Card>
    </>
  );
}
