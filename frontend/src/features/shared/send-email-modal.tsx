"use client";

import { useState } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/services/api";

/** Reports success only from the provider's confirmation; a failure leaves the record unchanged. */
export function SendEmailModal({
  open,
  onClose,
  path,
  defaultTo,
  documentLabel,
  invalidate,
}: {
  open: boolean;
  onClose: () => void;
  path: string;
  defaultTo?: string;
  documentLabel: string;
  invalidate: string[];
}) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [failure, setFailure] = useState("");
  const send = useApiMutation<void>({
    request: () => api.post(path, { to: to.trim() || undefined }),
    invalidate,
    toastError: false,
    onSuccess: onClose,
    onError: (error) => setFailure(error.message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Email ${documentLabel}`}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={send.isPending}
            onClick={() => {
              setFailure("");
              send.mutate();
            }}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {failure && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {failure}
          </p>
        )}
        <FormField label="Recipient" hint="The PDF is attached">
          {(f) => <Input {...f} type="email" value={to} onChange={(e) => setTo(e.target.value)} />}
        </FormField>
      </div>
    </Modal>
  );
}
