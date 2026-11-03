"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, FormField, Input } from "@/components/ui";
import { authClient } from "@/services/auth-client";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    setError("");
    const result = await authClient.signIn.email(values);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Incorrect email or password, or this account is inactive.",
      );
      return;
    }
    // Only same-site paths are followed, so a crafted link cannot redirect off-site after sign-in.
    const next = params.get("next");
    window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-[13px] text-ink-2">Use the account your administrator created.</p>
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
      <FormField label="Password" error={errors.password?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("password")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </FormField>
      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-[13px]">
        <Link href="/forgot-password" className="text-accent hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
