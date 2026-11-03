"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, FormField, Input } from "@/components/ui";
import { authClient } from "@/services/auth-client";

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function ResetForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold">This link is not valid</h1>
        <p className="text-ink-2">It may have expired or already been used.</p>
        <Link href="/forgot-password" className="text-[13px] text-accent hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }
  if (done) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold">Password updated</h1>
        <p className="text-ink-2">You can now sign in with your new password.</p>
        <Link href="/login" className="text-[13px] text-accent hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  const submit = handleSubmit(async ({ password }) => {
    setError("");
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) setError("This link has expired or was already used. Request a new one.");
    else setDone(true);
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      <FormField label="New password" error={errors.password?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("password")}
            type="password"
            autoComplete="new-password"
            autoFocus
          />
        )}
      </FormField>
      <FormField label="Confirm password" error={errors.confirm?.message}>
        {(field) => (
          <Input {...field} {...register("confirm")} type="password" autoComplete="new-password" />
        )}
      </FormField>
      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Update password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
