"use client";

import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui";
import { InvoiceEditor } from "@/features/invoices/invoice-editor";
import { useMe } from "@/hooks/use-me";

export default function NewInvoicePage() {
  const params = useSearchParams();
  const { me } = useMe();
  if (!me) return <LoadingSkeleton rows={8} />;
  return (
    <InvoiceEditor
      defaults={{
        client: params.get("client") ?? undefined,
        project: params.get("project") ?? undefined,
      }}
    />
  );
}
