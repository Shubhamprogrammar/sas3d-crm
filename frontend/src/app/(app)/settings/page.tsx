"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, type FieldValues, type UseFormRegister } from "react-hook-form";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingSkeleton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/components/layout/providers";
import { NotificationPreferences } from "@/features/settings/notification-preferences";
import { useApiList, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useFormat, useMe } from "@/hooks/use-me";
import { COMMON_TIMEZONES, CURRENCIES, label } from "@/lib/constants";
import { api, downloadFile } from "@/services/api";

interface Numbering {
  prefix: string;
  padding: number;
  includeYear: boolean;
}
interface Settings {
  company: {
    name: string;
    logoUrl: string;
    website: string;
    email: string;
    phone: string;
    address: string;
    taxInfo: string;
  };
  preferences: {
    defaultCurrency: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    theme: string;
  };
  documents: {
    proposal: Numbering & { introduction: string; defaultTerms: string; footer: string };
    invoice: Numbering & { defaultPaymentTerms: string; bankDetails: string; footer: string };
  };
}

function useSaveSettings() {
  return useApiMutation<Partial<Settings>>({
    request: (body) => api.patch("/settings", body),
    invalidate: ["/settings", "/me"],
  });
}

function CompanyTab({ settings, readOnly }: { settings: Settings; readOnly: boolean }) {
  const toast = useToast();
  const { register, handleSubmit, setValue, watch } = useForm({ defaultValues: settings.company });
  const save = useSaveSettings();
  const logo = watch("logoUrl");
  const pickLogo = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type))
      return toast.error("Logo must be a PNG or JPEG");
    if (file.size > 500 * 1024) return toast.error("Logo must be under 500 KB");
    const reader = new FileReader();
    reader.onload = () => setValue("logoUrl", String(reader.result), { shouldDirty: true });
    reader.readAsDataURL(file);
  };
  return (
    <form
      onSubmit={handleSubmit((company) => save.mutate({ company }))}
      noValidate
      className="max-w-3xl space-y-3"
    >
      <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Company name" required>
          {(f) => <Input {...f} {...register("name")} />}
        </FormField>
        <FormField label="Website">
          {(f) => <Input type="url" {...f} {...register("website")} />}
        </FormField>
        <FormField label="Email">
          {(f) => <Input type="email" {...f} {...register("email")} />}
        </FormField>
        <FormField label="Phone">
          {(f) => <Input type="tel" {...f} {...register("phone")} />}
        </FormField>
        <FormField label="Business address" className="sm:col-span-2">
          {(f) => <Textarea {...f} {...register("address")} />}
        </FormField>
        <FormField
          label="Tax information"
          hint="Shown on proposals and invoices, e.g. GSTIN"
          className="sm:col-span-2"
        >
          {(f) => <Textarea rows={2} {...f} {...register("taxInfo")} />}
        </FormField>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[13px] font-medium text-ink-2">Logo</p>
          <div className="flex flex-wrap items-center gap-3">
            {logo ? (
              <img
                src={logo}
                alt="Company logo"
                className="h-12 max-w-40 rounded border border-line object-contain p-1"
              />
            ) : (
              <span className="text-ink-3">No logo. Documents show the company name instead.</span>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg"
              aria-label="Upload logo"
              className="max-w-64 pt-1.5"
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            {logo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValue("logoUrl", "", { shouldDirty: true })}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </fieldset>
      {!readOnly && (
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save company details
        </Button>
      )}
    </form>
  );
}

function PreferencesTab({ settings, readOnly }: { settings: Settings; readOnly: boolean }) {
  const { register, handleSubmit } = useForm({ defaultValues: settings.preferences });
  const save = useSaveSettings();
  const { theme, setTheme } = useTheme();
  return (
    <div className="max-w-3xl space-y-6">
      <form
        onSubmit={handleSubmit((preferences) => save.mutate({ preferences }))}
        noValidate
        className="space-y-3"
      >
        <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
          <FormField label="Default currency">
            {(f) => (
              <Select
                {...f}
                {...register("defaultCurrency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            )}
          </FormField>
          <FormField
            label="Company timezone"
            hint="Used for internal defaults, date ranges and due dates"
          >
            {(f) => (
              <Select
                {...f}
                {...register("timezone")}
                options={COMMON_TIMEZONES.map((z) => ({ value: z, label: z }))}
              />
            )}
          </FormField>
          <FormField label="Date format">
            {(f) => (
              <Select
                {...f}
                {...register("dateFormat")}
                options={["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((v) => ({
                  value: v,
                  label: v,
                }))}
              />
            )}
          </FormField>
          <FormField label="Time format">
            {(f) => (
              <Select
                {...f}
                {...register("timeFormat")}
                options={[
                  { value: "12h", label: "12 hour" },
                  { value: "24h", label: "24 hour" },
                ]}
              />
            )}
          </FormField>
        </fieldset>
        {!readOnly && (
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save preferences
          </Button>
        )}
      </form>
      <FormField label="Your theme" hint="Saved in this browser" className="max-w-xs">
        {(f) => (
          <Select
            {...f}
            value={theme}
            onChange={(e) => setTheme(e.target.value as "light" | "dark")}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        )}
      </FormField>
    </div>
  );
}

function NumberingFields({
  register,
  kind,
}: {
  register: UseFormRegister<FieldValues>;
  kind: "proposal" | "invoice";
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField label="Number prefix">
        {(f) => <Input {...f} {...register(`${kind}.prefix`)} />}
      </FormField>
      <FormField label="Digits">
        {(f) => (
          <Input
            type="number"
            min={3}
            max={8}
            {...f}
            {...register(`${kind}.padding`, { valueAsNumber: true })}
          />
        )}
      </FormField>
      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          {...register(`${kind}.includeYear`)}
        />
        Include year
      </label>
    </div>
  );
}

function DocumentsTab({ settings, readOnly }: { settings: Settings; readOnly: boolean }) {
  const { register, handleSubmit } = useForm<FieldValues>({ defaultValues: settings.documents });
  const save = useSaveSettings();
  return (
    <form
      onSubmit={handleSubmit((documents) =>
        save.mutate({ documents: documents as Settings["documents"] }),
      )}
      noValidate
      className="max-w-3xl space-y-6"
    >
      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="mb-2 font-medium">Proposal template</legend>
        <NumberingFields register={register} kind="proposal" />
        <FormField label="Introduction" hint="Appears at the top of each proposal PDF">
          {(f) => <Textarea {...f} {...register("proposal.introduction")} />}
        </FormField>
        <FormField label="Default terms and conditions">
          {(f) => <Textarea rows={5} {...f} {...register("proposal.defaultTerms")} />}
        </FormField>
        <FormField label="Footer">
          {(f) => <Input {...f} {...register("proposal.footer")} />}
        </FormField>
      </fieldset>
      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="mb-2 font-medium">Invoice template</legend>
        <NumberingFields register={register} kind="invoice" />
        <FormField label="Default payment terms">
          {(f) => <Textarea {...f} {...register("invoice.defaultPaymentTerms")} />}
        </FormField>
        <FormField label="Bank and payment details" hint="Printed on each invoice">
          {(f) => <Textarea rows={5} {...f} {...register("invoice.bankDetails")} />}
        </FormField>
        <FormField label="Footer">
          {(f) => <Input {...f} {...register("invoice.footer")} />}
        </FormField>
      </fieldset>
      {!readOnly && (
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save document settings
        </Button>
      )}
    </form>
  );
}

function UsersTab() {
  const { data, isLoading } = useApiQuery<{ roles: string[]; matrix: Record<string, string[]> }>(
    "/settings/roles",
  );
  if (isLoading || !data) return <LoadingSkeleton />;
  const permissions = data.matrix.SUPER_ADMIN ?? [];
  return (
    <div className="space-y-3">
      <p className="text-ink-2">
        Roles and their permissions are fixed in the application and enforced on the server.
        Accounts are managed from the{" "}
        <Link className="text-accent hover:underline" href="/team">
          Team
        </Link>{" "}
        page.
      </p>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Permission</th>
              {data.roles.map((role) => (
                <th key={role} className="whitespace-nowrap px-2 py-2 font-medium">
                  {label(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission} className="border-t border-line">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono">{permission}</td>
                {data.roles.map((role) => (
                  <td key={role} className="px-2 py-1.5 text-center">
                    {data.matrix[role]?.includes(permission) ? (
                      <span className="text-good">Yes</span>
                    ) : (
                      <span className="text-ink-3">No</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AuditEntry {
  _id: string;
  action: string;
  entityType: string;
  summary: string;
  ip: string;
  createdAt: string;
  actor: { name: string } | null;
}
interface SystemInfo {
  database: string;
  counts: { collection: string; documents: number }[];
  emailConfigured: boolean;
  storageDriver: string;
  backupGuidance: string;
  jobs: { enabled: boolean; intervalSeconds: number; lastRunAt: string | null };
}

function SystemTab() {
  const { can } = useMe();
  const format = useFormat();
  const toast = useToast();
  const list = useListState({});
  const logs = useApiList<AuditEntry>(
    can("audit:read") ? "/settings/audit-logs" : null,
    list.params,
  );
  const { data: system } = useApiQuery<SystemInfo>("/settings/system");
  const [collection, setCollection] = useState("leads");
  return (
    <div className="space-y-6">
      {system && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="System status">
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Email delivery</dt>
                <dd>
                  {system.emailConfigured ? "Configured" : "Not configured: emails are not sent"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">File storage</dt>
                <dd>{label(system.storageDriver)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Scheduled jobs</dt>
                <dd>
                  {system.jobs.enabled ? `Every ${system.jobs.intervalSeconds}s` : "Disabled"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Last job run</dt>
                <dd>{format.dateTime(system.jobs.lastRunAt) || "Not yet"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Backups and data export">
            <p className="mb-3 text-[13px] text-ink-2">{system.backupGuidance}</p>
            {can("data:export") ? (
              <div className="flex gap-2">
                <Select
                  aria-label="Collection"
                  className="flex-1"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  options={system.counts.map((c) => ({
                    value: c.collection,
                    label: `${label(c.collection)} (${c.documents})`,
                  }))}
                />
                <Button
                  icon={<Download className="size-4" />}
                  onClick={() =>
                    downloadFile("/settings/export", `${collection}.json`, { collection }).catch(
                      (e: Error) => toast.error(e.message),
                    )
                  }
                >
                  Export JSON
                </Button>
              </div>
            ) : (
              <p className="text-xs text-ink-3">Only a Super Admin can export data</p>
            )}
          </Card>
        </div>
      )}
      {can("audit:read") && (
        <Card title="Activity log" padded={false}>
          <div className="border-b border-line p-3">
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search action or summary"
              className="max-w-sm"
            />
          </div>
          <DataTable
            rows={logs.items}
            rowKey={(r) => r._id}
            loading={logs.isLoading}
            error={logs.error}
            onRetry={logs.refetch}
            empty={<EmptyState icon={Search} title="No log entries found" />}
            columns={[
              {
                key: "when",
                header: "When",
                render: (r) => (
                  <span className="whitespace-nowrap">{format.dateTime(r.createdAt)}</span>
                ),
              },
              { key: "who", header: "Who", render: (r) => r.actor?.name ?? "System" },
              {
                key: "action",
                header: "Action",
                render: (r) => <span className="font-mono text-xs">{r.action}</span>,
              },
              { key: "summary", header: "Summary", render: (r) => r.summary },
              {
                key: "ip",
                header: "IP",
                render: (r) => <span className="text-xs text-ink-3">{r.ip}</span>,
              },
            ]}
          />
          {logs.meta && (
            <Pagination
              page={logs.meta.page}
              pages={logs.meta.pages}
              total={logs.meta.total}
              onChange={list.setPage}
            />
          )}
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { can } = useMe();
  const [tab, setTab] = useState("company");
  const { data, isLoading, error, refetch } = useApiQuery<Settings>("/settings");
  const readOnly = !can("settings:write");
  return (
    <>
      <PageHeader
        title="Settings"
        description={readOnly ? "Only a Super Admin can change these settings." : undefined}
      />
      <div className="mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "company", label: "Company" },
            { key: "preferences", label: "Preferences" },
            { key: "documents", label: "Documents" },
            { key: "users", label: "Users and roles" },
            { key: "notifications", label: "Notifications" },
            { key: "system", label: "System" },
          ]}
        />
      </div>
      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {tab === "company" && <CompanyTab settings={data} readOnly={readOnly} />}
          {tab === "preferences" && <PreferencesTab settings={data} readOnly={readOnly} />}
          {tab === "documents" && <DocumentsTab settings={data} readOnly={readOnly} />}
          {tab === "users" && <UsersTab />}
          {tab === "notifications" && (
            <div className="max-w-3xl">
              <NotificationPreferences />
            </div>
          )}
          {tab === "system" && <SystemTab />}
        </>
      )}
    </>
  );
}
