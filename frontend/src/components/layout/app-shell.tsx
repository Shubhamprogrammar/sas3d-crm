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

const NAV: { href: string; label: string; icon: LucideIcon; permission: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/leads", label: "Leads", icon: Users, permission: "lead:read" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, permission: "opportunity:read" },
  { href: "/clients", label: "Clients", icon: Building2, permission: "client:read" },
  { href: "/tasks", label: "Tasks & Follow-ups", icon: CheckSquare, permission: "task:read" },
  { href: "/proposals", label: "Proposals", icon: FileText, permission: "proposal:read" },
  { href: "/projects", label: "Projects", icon: FolderKanban, permission: "project:read" },
  { href: "/invoices", label: "Invoices & Payments", icon: Receipt, permission: "invoice:read" },
  { href: "/services", label: "Services", icon: Package, permission: "service:read" },
  { href: "/team", label: "Team", icon: UsersRound, permission: "team:read" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "report:*" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings:read" },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, me } = useMe();
  const canSee = (permission: string) =>
    permission === "report:*"
      ? ["report:sales", "report:finance", "report:projects", "report:team"].some(can)
      : can(permission);
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-on-accent">
          <Box className="size-4" aria-hidden />
        </span>
        <span className="font-semibold tracking-tight">{me?.companyName ?? "SAS3D"} CRM</span>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.filter((item) => canSee(item.permission)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent hover:bg-accent-hover sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-[13px] sm:font-medium">
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
        <aside className="hidden w-56 shrink-0 border-r border-line bg-surface lg:block">
          <Sidebar />
        </aside>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onMouseDown={(e) => e.target === e.currentTarget && setMobileOpen(false)}
          >
            <aside className="relative h-full w-64 bg-surface shadow-pop">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-3"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                icon={<X className="size-4" />}
              />
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              icon={<Menu className="size-4" />}
            />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
              <QuickCreate />
              <NotificationBell />
              <ThemeSwitch />
              <UserMenu />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
              <Suspense>{children}</Suspense>
            </div>
          </main>
        </div>
      </div>
    </MeProvider>
  );
}
