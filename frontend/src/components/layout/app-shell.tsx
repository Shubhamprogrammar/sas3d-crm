"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Box,
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Settings,
  Sun,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Avatar, Button, Dropdown, type MenuItem } from "@/components/ui";
import { MeProvider, useMe } from "@/hooks/use-me";
import { label } from "@/lib/constants";
import { authClient } from "@/services/auth-client";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { useTheme } from "./providers";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Navigation",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "dashboard:read",
      },
      { href: "/leads", label: "Leads", icon: Users, permission: "lead:read" },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, permission: "opportunity:read" },
      { href: "/clients", label: "Clients", icon: Building2, permission: "client:read" },
      { href: "/tasks", label: "Tasks & Follow-ups", icon: CheckSquare, permission: "task:read" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/proposals", label: "Proposals", icon: FileText, permission: "proposal:read" },
      { href: "/projects", label: "Projects", icon: FolderKanban, permission: "project:read" },
      {
        href: "/invoices",
        label: "Invoices & Payments",
        icon: Receipt,
        permission: "invoice:read",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/services", label: "Services", icon: Package, permission: "service:read" },
      { href: "/team", label: "Team", icon: UsersRound, permission: "team:read" },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "report:*" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function Sidebar({ onNavigate, search }: { onNavigate?: () => void; search?: boolean }) {
  const pathname = usePathname();
  const { can, me } = useMe();
  const canSee = (permission: string) =>
    permission === "report:*"
      ? ["report:sales", "report:finance", "report:projects", "report:team"].some(can)
      : can(permission);
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-6">
        <Box className="size-5 text-side-text" aria-hidden />
        <span className="text-[15px] font-medium text-side-text">
          {me?.companyName ?? "SAS3D"} CRM
        </span>
      </div>
      {search && (
        <div className="shrink-0 border-b border-line px-3 pb-4">
          <GlobalSearch />
        </div>
      )}
      <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canSee(item.permission));
          if (!items.length) return null;
          return (
            <div key={group.label} className="px-3 py-4">
              <p className="mb-2 px-3 font-mono text-xs text-ink-3">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isCurrent(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-9 items-center gap-2.5 rounded-lg px-3 transition-colors ${active ? "bg-linear-to-b from-side-active to-side-active-end text-side-text shadow-[inset_0_1px_0_var(--side-highlight)] ring-1 ring-line" : "text-side-text-2 hover:bg-side-hover hover:text-side-text"}`}
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** The current section's name, in the top bar on desktop. */
function SectionName() {
  const pathname = usePathname();
  const item = NAV_GROUPS.flatMap((group) => group.items).find((candidate) =>
    isCurrent(pathname, candidate.href),
  );
  if (!item) return null;
  return (
    <span className="hidden items-center gap-2.5 text-ink-2 lg:flex">
      <item.icon className="size-4" aria-hidden />
      {item.label}
    </span>
  );
}

function QuickCreate() {
  const { can } = useMe();
  const items: MenuItem[] = [
    { label: "New lead", href: "/leads?new=1", icon: Users, hidden: !can("lead:write") },
    { label: "New client", href: "/clients?new=1", icon: Building2, hidden: !can("client:write") },
    { label: "New task", href: "/tasks?new=1", icon: CheckSquare, hidden: !can("task:write") },
    {
      label: "New proposal",
      href: "/proposals/new",
      icon: FileText,
      hidden: !can("proposal:write"),
    },
    {
      label: "New project",
      href: "/projects?new=1",
      icon: BriefcaseBusiness,
      hidden: !can("project:create"),
    },
    { label: "New invoice", href: "/invoices/new", icon: Receipt, hidden: !can("invoice:write") },
  ];
  return (
    <Dropdown
      items={items}
      ariaLabel="Quick create"
      trigger={
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary hover:bg-primary-hover sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-[13px] sm:font-medium">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Create</span>
        </span>
      }
    />
  );
}

function UserMenu() {
  const { me } = useMe();
  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };
  return (
    <Dropdown
      ariaLabel="Account menu"
      trigger={<Avatar name={me?.user.name} image={me?.user.image} />}
      items={[
        {
          label: `${me?.user.name ?? ""} (${label(me?.user.role)})`,
          href: "/profile",
          icon: UserRound,
        },
        { label: "Sign out", onClick: signOut, icon: LogOut },
      ]}
    />
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      icon={theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <MeProvider>
      <div className="flex h-dvh">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-side lg:block">
          <Sidebar search />
        </aside>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onMouseDown={(e) => e.target === e.currentTarget && setMobileOpen(false)}
          >
            <aside className="relative h-full w-64 bg-side shadow-pop">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-4 text-side-text! hover:bg-side-hover!"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                icon={<X className="size-4" />}
              />
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              icon={<Menu className="size-4" />}
            />
            <div className="min-w-0 flex-1 lg:hidden">
              <GlobalSearch />
            </div>
            <SectionName />
            <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
              <QuickCreate />
              <NotificationBell />
              <ThemeSwitch />
              <UserMenu />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
              <Suspense>{children}</Suspense>
            </div>
          </main>
        </div>
      </div>
    </MeProvider>
  );
}
