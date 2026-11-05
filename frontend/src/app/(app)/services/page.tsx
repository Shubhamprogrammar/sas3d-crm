"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
  type Column,
} from "@/components/ui";
import { applyServerErrors } from "@/features/shared/form-errors";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useMe } from "@/hooks/use-me";
import { CURRENCIES, label, PRICING_MODELS, SERVICE_CATEGORIES, toOptions } from "@/lib/constants";
import { api } from "@/services/api";
import type { Service } from "@/types";
import { splitList } from "@/utils/format";
import { formatMoney, fromMinor, isValidAmount, toMinor } from "@/utils/money";

const schema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  description: z.string(),
  category: z.enum(SERVICE_CATEGORIES),
  startingPrice: z.string().refine(isValidAmount, "Enter an amount"),
  currency: z.enum(CURRENCIES),
  pricingModel: z.enum(PRICING_MODELS),
  estimatedDelivery: z.string(),
  technologies: z.string(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function ServiceForm({
  open,
  onClose,
  service,
}: {
  open: boolean;
  onClose: () => void;
  service: Service | null;
}) {
  const { preferences } = useMe();
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
        name: service?.name ?? "",
        description: service?.description ?? "",
        category: (service?.category ?? "WEB_DEVELOPMENT") as Values["category"],
        startingPrice: service ? fromMinor(service.startingPrice) : "",
        currency: (service?.currency ?? preferences.defaultCurrency) as Values["currency"],
        pricingModel: (service?.pricingModel ?? "FIXED") as Values["pricingModel"],
        estimatedDelivery: service?.estimatedDelivery ?? "",
        technologies: service?.technologies.join(", ") ?? "",
        isActive: service?.isActive ?? true,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service]);
  const save = useApiMutation<Values>({
    request: (values) => {
      const body = {
        ...values,
        startingPrice: toMinor(values.startingPrice),
        technologies: splitList(values.technologies),
      };
      return service ? api.patch(`/services/${service._id}`, body) : api.post("/services", body);
    },
    invalidate: ["/services"],
    onSuccess: onClose,
    onError: (error) => applyServerErrors(error, setError),
  });
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={service ? "Edit service" : "New service"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="service-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="service-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="space-y-3"
        noValidate
      >
        <FormField label="Service name" required error={errors.name?.message}>
          {(f) => <Input {...f} {...register("name")} />}
        </FormField>
        <FormField label="Description">
          {(f) => <Textarea {...f} {...register("description")} />}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Category">
            {(f) => (
              <Select {...f} {...register("category")} options={toOptions(SERVICE_CATEGORIES)} />
            )}
          </FormField>
          <FormField label="Pricing model">
            {(f) => (
              <Select {...f} {...register("pricingModel")} options={toOptions(PRICING_MODELS)} />
            )}
          </FormField>
          <FormField label="Starting price" error={errors.startingPrice?.message}>
            {(f) => (
              <Input inputMode="decimal" placeholder="0.00" {...f} {...register("startingPrice")} />
            )}
          </FormField>
          <FormField label="Currency">
            {(f) => (
              <Select
                {...f}
                {...register("currency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            )}
          </FormField>
          <FormField label="Estimated delivery">
            {(f) => (
              <Input {...f} placeholder="e.g. 4 to 6 weeks" {...register("estimatedDelivery")} />
            )}
          </FormField>
          <FormField label="Technologies" hint="Separated by commas">
            {(f) => <Input {...f} {...register("technologies")} />}
          </FormField>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            {...register("isActive")}
          />
          Active, and available when creating proposals
        </label>
      </form>
    </Drawer>
  );
}

export default function ServicesPage() {
  const { can } = useMe();
  const list = useListState({ category: "", active: "" });
  const { items, meta, isLoading, error, refetch } = useApiList<Service>("/services", list.params);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const columns: Column<Service>[] = [
    {
      key: "name",
      header: "Service",
      render: (s) => (
        <div className="min-w-44">
          <p className="font-medium">{s.name}</p>
          <p className="line-clamp-1 text-xs text-ink-3">{s.description}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (s) => label(s.category) },
    { key: "model", header: "Pricing", render: (s) => label(s.pricingModel) },
    { key: "delivery", header: "Delivery", render: (s) => s.estimatedDelivery },
    {
      key: "tech",
      header: "Technologies",
      render: (s) => <span className="line-clamp-1">{s.technologies.join(", ")}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge status={s.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "price",
      header: "Starting price",
      align: "right",
      render: (s) =>
        s.startingPrice ? (
          <span className="whitespace-nowrap">{formatMoney(s.startingPrice, s.currency)}</span>
        ) : (
          <span className="text-ink-3">Not set</span>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Services"
        description="The catalogue offered when creating proposals and invoices"
        actions={
          can("service:write") && (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setEditing("new")}
            >
              New service
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_220px_160px]">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search services"
          />
          <Select
            aria-label="Category"
            value={list.filters.category}
            onChange={(e) => list.setFilter("category", e.target.value)}
            options={toOptions(SERVICE_CATEGORIES)}
            placeholder="All categories"
          />
          <Select
            aria-label="Status"
            value={list.filters.active}
            onChange={(e) => list.setFilter("active", e.target.value)}
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
            placeholder="Any status"
          />
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(s) => s._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={can("service:write") ? setEditing : undefined}
          empty={<EmptyState icon={Package} title="No services found" />}
        />
        {meta && (
          <Pagination
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            onChange={list.setPage}
          />
        )}
      </Card>
      <ServiceForm
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        service={editing === "new" ? null : editing}
      />
    </>
  );
}
