"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useFormat } from "@/hooks/use-me";
import { api } from "@/services/api";
import type { Notification } from "@/types";

export function NotificationBell() {
  const router = useRouter();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { data: unread } = useApiQuery<{ count: number }>(
    "/notifications/unread-count",
    undefined,
    { refetchInterval: 60_000 },
  );
  const { data: items } = useApiQuery<Notification[]>(open ? "/notifications" : null, { limit: 8 });
  const count = unread?.count ?? 0;

  const markRead = useApiMutation<string>({
    request: (id) => api.post(`/notifications/${id}/read`),
    invalidate: ["/notifications"],
    toastSuccess: false,
  });
  const markAll = useApiMutation({
    request: () => api.post("/notifications/read-all"),
    invalidate: ["/notifications"],
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) =>
      !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openItem = (item: Notification) => {
    if (!item.readAt) markRead.mutate(item._id);
    setOpen(false);
    if (item.link) router.push(item.link);
  };

  return (
    <div className="relative" ref={root}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications, ${count} unread`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
        icon={<Bell className="size-4" />}
      >
        {count > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[11px] font-semibold text-white dark:text-bg">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
      {open && (
        <div className="fixed left-3 right-3 top-14 z-40 rounded-xl border border-line bg-surface shadow-pop sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-medium">Notifications</span>
            <Button variant="ghost" size="sm" disabled={!count} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!items?.length && (
              <li className="px-3 py-8 text-center text-[13px] text-ink-2">
                You have no notifications
              </li>
            )}
            {items?.map((item) => (
              <li key={item._id}>
                <button
                  onClick={() => openItem(item)}
                  className="flex w-full cursor-pointer gap-2.5 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-accent"}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-ink-2">{item.message}</span>
                    <span className="block text-xs text-ink-3">
                      {format.dateTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-3 py-2 text-center text-[13px] text-accent hover:underline"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
