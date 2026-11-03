import { Box } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Box className="size-5" aria-hidden />
        </span>
        <span className="text-lg font-semibold tracking-tight">SAS3D CRM</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">
        {children}
      </div>
    </main>
  );
}
