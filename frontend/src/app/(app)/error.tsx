"use client";

import { CircleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <EmptyState
        icon={CircleAlert}
        title="This page hit a problem"
        description="Nothing was lost. Try again, or go back to the previous page."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
