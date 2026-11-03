"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Avatar,
  Button,
  Card,
  FormField,
  Input,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { NotificationPreferences } from "@/features/settings/notification-preferences";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { api } from "@/services/api";
import { authClient } from "@/services/auth-client";
import type { Me } from "@/types";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string(),
  image: z.string(),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function ProfileForm({ user }: { user: Me["user"] }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone, image: user.image ?? "" },
  });
  const save = useApiMutation<z.infer<typeof profileSchema>>({
    request: (values) => api.patch("/me", values),
    invalidate: ["/me", "/team"],
    onError: (error) => applyServerErrors(error, setError),
  });
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-3">
      <FormField label="Name" required error={errors.name?.message}>
        {(f) => <Input {...f} {...register("name")} />}
      </FormField>
      <FormField label="Phone" error={errors.phone?.message}>
        {(f) => <Input type="tel" {...f} {...register("phone")} />}
      </FormField>
      <FormField label="Profile image URL" error={errors.image?.message}>
        {(f) => <Input type="url" placeholder="https://" {...f} {...register("image")} />}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [failure, setFailure] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema) });
  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure("");
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (result.error)
      return setFailure("The current password is incorrect, or the new one is not allowed.");
    reset({ currentPassword: "", newPassword: "", confirm: "" });
    toast.success("Password changed. Other devices were signed out.");
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {failure && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {failure}
        </p>
      )}
      <FormField label="Current password" error={errors.currentPassword?.message}>
        {(f) => (
          <Input
            type="password"
            autoComplete="current-password"
            {...f}
            {...register("currentPassword")}
          />
        )}
      </FormField>
      <FormField label="New password" error={errors.newPassword?.message}>
        {(f) => (
          <Input type="password" autoComplete="new-password" {...f} {...register("newPassword")} />
        )}
      </FormField>
      <FormField label="Confirm new password" error={errors.confirm?.message}>
        {(f) => (
          <Input type="password" autoComplete="new-password" {...f} {...register("confirm")} />
        )}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { me } = useMe();
  if (!me) return <LoadingSkeleton rows={6} />;
  return (
    <>
      <PageHeader title="Your profile" />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={me.user.name} image={me.user.image} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{me.user.email}</p>
              <p className="flex items-center gap-2 text-[13px] text-ink-2">
                {label(me.user.role)}
                <StatusBadge status={me.user.status} />
              </p>
            </div>
          </div>
          <ProfileForm user={me.user} />
        </Card>
        <Card title="Change password">
          <PasswordForm />
        </Card>
        <Card title="Notification preferences" className="lg:col-span-2">
          <NotificationPreferences />
        </Card>
      </div>
    </>
  );
}
