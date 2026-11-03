"use client";

import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui";
import { ProposalEditor } from "@/features/proposals/proposal-editor";
import { useMe } from "@/hooks/use-me";

export default function NewProposalPage() {
  const params = useSearchParams();
  const { me } = useMe();
  // The editor seeds its form from preferences once, so it waits for them to load.
  if (!me) return <LoadingSkeleton rows={8} />;
  return (
    <ProposalEditor
      defaults={{
        client: params.get("client") ?? undefined,
        lead: params.get("lead") ?? undefined,
      }}
    />
  );
}
