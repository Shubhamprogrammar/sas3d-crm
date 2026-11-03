"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingSkeleton } from "@/components/ui";
import { InvoiceEditor } from "@/features/invoices/invoice-editor";
import { useApiQuery } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { Invoice } from "@/types";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useMe();
  const { data, isLoading, error, refetch } = useApiQuery<Invoice>(`/invoices/${id}`);
  if (isLoading || !me) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return <InvoiceEditor invoice={data} />;
}
