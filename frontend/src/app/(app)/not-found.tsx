import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist"
        action={
          <Link className="text-accent hover:underline" href="/dashboard">
            Go to the dashboard
          </Link>
        }
      />
    </div>
  );
}
