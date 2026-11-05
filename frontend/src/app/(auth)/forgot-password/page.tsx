"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, FormField, Input } from "@/components/ui";
import { authClient } from "@/services/auth-client";

const schema = z.object({ email: z.email("Enter a valid email") });

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async ({ email }) => {
    setError("");
    const result = await authClient.requestPasswordReset({ email });
    if (result.error) setError(result.error.message ?? "The request could not be completed.");
    else setDone(true);
  });

  if (done) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-medium">Check your email</h1>
        <p className="text-ink-2">
          If an account exists for that address, a reset link is on its way. The link expires in one
          hour.
        </p>
        <p className="text-[13px] text-ink-3">
          If nothing arrives, ask your administrator to confirm that email delivery is configured.
        </p>
        <Link href="/login" className="text-[13px] text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Reset your password</h1>
        <p className="text-[13px] text-ink-2">We will email you a link to choose a new one</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      <FormField label="Email" error={errors.email?.message}>
        {(field) => (
          <Input {...field} {...register("email")} type="email" autoComplete="username" autoFocus />
        )}
      </FormField>
      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-[13px]">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
