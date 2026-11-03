"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  kind: "success" | "error";
  message: string;
}

const ToastContext = createContext<{
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (kind: ToastItem["kind"], message: string) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(
    () => ({ success: (m: string) => push("success", m), error: (m: string) => push("error", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-pop"
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            )}
            <p className="flex-1 text-[13px]">{toast.message}</p>
            <button
              className="cursor-pointer text-ink-3 hover:text-ink"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
