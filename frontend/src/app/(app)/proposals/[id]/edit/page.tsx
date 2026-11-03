"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingSkeleton } from "@/components/ui";
import { ProposalEditor } from "@/features/proposals/proposal-editor";
import { useApiQuery } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { Proposal } from "@/types";

export default function EditProposalPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useMe();
  const { data, isLoading, error, refetch } = useApiQuery<Proposal>(`/proposals/${id}`);
  if (isLoading || !me) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return <ProposalEditor proposal={data} />;
}
