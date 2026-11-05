"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ErrorState } from "@/components/ui";
import { useApiList } from "@/hooks/use-api";
import type { Task } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function TaskCalendar({
  params,
  onSelect,
}: {
  params: object;
  onSelect: (task: Task) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const days = useMemo(() => {
    const offset = (cursor.getDay() + 6) % 7;
    return Array.from(
      { length: 42 },
      (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset + index),
    );
  }, [cursor]);

  const { items, error, refetch } = useApiList<Task>("/tasks", {
    ...params,
    page: 1,
    limit: 500,
    from: days[0]?.toISOString(),
    to: days[41]?.toISOString(),
  });
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of items) {
      if (!task.dueAt) continue;
      const k = key(new Date(task.dueAt));
      map.set(k, [...(map.get(k) ?? []), task]);
    }
    return map;
  }, [items]);

  const today = key(new Date());
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line p-3">
        <h2 className="font-medium">{MONTH.format(cursor)}</h2>
        <div className="flex gap-1">
          <Button
            size="icon"
            aria-label="Previous month"
            icon={<ChevronLeft className="size-4" />}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          />
          <Button
            size="sm"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
          >
            Today
          </Button>
          <Button
            size="icon"
            aria-label="Next month"
            icon={<ChevronRight className="size-4" />}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7">
          {DAYS.map((day) => (
            <div
              key={day}
              className="border-b border-line px-2 py-1.5 text-xs font-medium text-ink-3"
            >
              {day}
            </div>
          ))}
          {days.map((day) => {
            const tasks = byDay.get(key(day)) ?? [];
            return (
              <div
                key={day.toISOString()}
                className={`min-h-24 border-b border-r border-line p-1 ${day.getMonth() === cursor.getMonth() ? "" : "bg-surface-2/60"}`}
              >
                <div
                  className={`tabular mb-0.5 inline-flex size-5 items-center justify-center rounded-full text-xs ${key(day) === today ? "bg-accent font-medium text-on-accent" : "text-ink-2"}`}
                >
                  {day.getDate()}
                </div>
                <ul className="space-y-0.5">
                  {tasks.slice(0, 4).map((task) => (
                    <li key={task._id}>
                      <button
                        onClick={() => onSelect(task)}
                        className={`block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-xs ${task.status === "COMPLETED" ? "bg-neutral-soft text-ink-3 line-through" : "bg-accent-soft text-accent"}`}
                      >
                        {task.title}
                      </button>
                    </li>
                  ))}
                  {tasks.length > 4 && (
                    <li className="px-1.5 text-xs text-ink-3">+{tasks.length - 4} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
