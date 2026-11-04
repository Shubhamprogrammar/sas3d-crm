"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, DatePicker, Drawer, FormField, Input, Select } from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useApiMutation } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { ROLES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { TeamMember } from "@/types";
import { dayInput, splitList } from "@/utils/format";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string(),
  phone: z.string(),
  image: z.string(),
  role: z.enum(ROLES),
  designation: z.string(),
  joiningDate: z.string(),
  skills: z.string(),
});
type Values = z.infer<typeof schema>;

export function MemberForm({
  open,
  onClose,
  member,
}: {
  open: boolean;
  onClose: () => void;
  member?: TeamMember | null;
}) {
  const { me } = useMe();
  // Admins cannot create or promote to admin-level roles; the API refuses it regardless.
  const roles =
    me?.user.role === "SUPER_ADMIN"
      ? ROLES
      : ROLES.filter((r) => r !== "SUPER_ADMIN" && r !== "ADMIN");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open)
      reset({
        name: member?.name ?? "",
        email: member?.email ?? "",
        password: "",
        phone: member?.phone ?? "",
        image: member?.image ?? "",
        role: (member?.role ?? "DEVELOPER") as Values["role"],
        designation: member?.designation ?? "",
        joiningDate: dayInput(member?.joiningDate),
        skills: member?.skills?.join(", ") ?? "",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);
  const save = useApiMutation<Values>({
    request: ({ password, ...values }) => {
      const body = {
        ...values,
        joiningDate: values.joiningDate || null,
        skills: splitList(values.skills),
      };
      return member
        ? api.patch(`/team/${member._id}`, body)
        : api.post("/team", { ...body, password });
    },
    invalidate: ["/team"],
    onSuccess: onClose,
    onError: (error) => applyServerErrors(error, setError),
  });
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={member ? "Edit team member" : "New team member"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="member-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="member-form"
        onSubmit={handleSubmit((values) => {
          if (!member && values.password.length < 10)
            return setError("password", { message: "Use at least 10 characters" });
          save.mutate(values);
        })}
        className="grid gap-3 sm:grid-cols-2"
        noValidate
      >
        <FormField label="Name" required error={errors.name?.message}>
          {(f) => <Input {...f} {...register("name")} />}
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          {(f) => <Input type="email" {...f} {...register("email")} />}
        </FormField>
        {!member && (
          <FormField
            label="Initial password"
            required
            hint="Share it securely. They can change it from their profile."
            error={errors.password?.message}
            className="sm:col-span-2"
          >
            {(f) => (
              <Input type="password" autoComplete="new-password" {...f} {...register("password")} />
            )}
          </FormField>
        )}
        <FormField label="Role" required>
          {(f) => <Select {...f} {...register("role")} options={toOptions(roles)} />}
        </FormField>
        <FormField label="Designation">
          {(f) => <Input {...f} {...register("designation")} />}
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          {(f) => <Input type="tel" {...f} {...register("phone")} />}
        </FormField>
        <FormField label="Joining date">
          {(f) => <DatePicker {...f} {...register("joiningDate")} />}
        </FormField>
        <FormField
          label="Profile image URL"
          error={errors.image?.message}
          className="sm:col-span-2"
        >
          {(f) => <Input type="url" placeholder="https://" {...f} {...register("image")} />}
        </FormField>
        <FormField label="Skills" hint="Separated by commas" className="sm:col-span-2">
          {(f) => <Input {...f} {...register("skills")} />}
        </FormField>
      </form>
    </Drawer>
  );
}
