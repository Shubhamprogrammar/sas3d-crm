"use client";

import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { label, NOTIFICATION_TYPES } from "@/lib/constants";
import { api } from "@/services/api";

export function NotificationPreferences() {
  const { me } = useMe();
  const muted = me?.user.mutedNotifications ?? [];
  const save = useApiMutation<string[]>({
    request: (next) => api.patch("/me", { mutedNotifications: next }),
    invalidate: ["/me"],
    toastSuccess: false,
  });
  return (
    <fieldset disabled={save.isPending}>
      <legend className="mb-2 text-[13px] text-ink-2">
        Choose what appears in your notification center.
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {NOTIFICATION_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={!muted.includes(type)}
              onChange={(e) =>
                save.mutate(e.target.checked ? muted.filter((t) => t !== type) : [...muted, type])
              }
            />
            {label(type)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
