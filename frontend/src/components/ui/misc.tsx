"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { label } from "@/lib/constants";
import { initials } from "@/utils/format";
import { Button } from "./button";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-3",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
};

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "good",
  WON: "good",
  PAID: "good",
  ACCEPTED: "good",
  COMPLETED: "good",
  DELIVERED: "good",
  LOST: "bad",
  OVERDUE: "bad",
  REJECTED: "bad",
  CANCELLED: "bad",
  URGENT: "bad",
  PARTIALLY_PAID: "warn",
  ON_HOLD: "warn",
  EXPIRED: "warn",
  NEGOTIATION: "warn",
  HIGH: "warn",
  TESTING: "warn",
  SENT: "info",
  VIEWED: "info",
  IN_PROGRESS: "info",
  CONTACTED: "info",
  INTERESTED: "info",
  MEETING_SCHEDULED: "info",
  PROPOSAL_SENT: "info",
  PLANNING: "info",
};

export function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-2">
      <span
        className={`size-1.5 shrink-0 rounded-full ${TONES[tone ?? STATUS_TONES[status] ?? "neutral"]}`}
        aria-hidden
      />
      {label(status)}
    </span>
  );
}

export function Avatar({
  name,
  image,
  size = "md",
}: {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = { sm: "size-6 text-[11px]", md: "size-8 text-xs", lg: "size-14 text-lg" }[size];
  return image ? (
    <img src={image} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden
      className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent`}
    >
      {initials(name)}
    </span>
  );
}

export function UserChip({ user }: { user?: { name?: string; image?: string | null } | null }) {
  if (!user?.name) return <span className="text-ink-3">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar name={user.name} image={user.image} size="sm" />
      <span className="truncate">{user.name}</span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-neutral-soft ${className}`} />;
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  const notFound = (error as { status?: number } | null)?.status === 404;
  return (
    <EmptyState
      icon={CircleAlert}
      title={notFound ? "Not found" : "This could not be loaded"}
      description={
        notFound ? "It may have been removed, or you may not have access to it." : error?.message
      }
      action={onRetry && !notFound ? <Button onClick={onRetry}>Try again</Button> : undefined}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-3"
        aria-hidden
      />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] text-ink-2">
      <span className="tabular">
        {total.toLocaleString("en-US")} {total === 1 ? "record" : "records"}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft className="size-4" />}
        />
        <span className="tabular px-1.5">
          Page {page} of {pages}
        </span>
        <Button
          size="icon"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          icon={<ChevronRight className="size-4" />}
        />
      </div>
    </div>
  );
}

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === active}
          onClick={() => onChange(tab.key)}
          className={`-mb-px cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${tab.key === active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="tabular ml-1.5 text-ink-3">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface MenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  danger?: boolean;
  hidden?: boolean;
}

export function Dropdown({
  items,
  trigger,
  ariaLabel = "More actions",
  align = "right",
}: {
  items: MenuItem[];
  trigger?: ReactNode;
  ariaLabel?: string;
  align?: "left" | "right";
}) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = position !== null;
  const visible = items.filter((item) => !item.hidden);

  // The menu is fixed to the viewport so scrolling tables and board columns cannot clip it.
  const toggle = () => {
    if (open || !root.current) return setPosition(null);
    const rect = root.current.getBoundingClientRect();
    const estimatedHeight = visible.length * 34 + 10;
    const flip = rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
    setPosition({
      position: "fixed",
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(align === "right"
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.max(8, rect.left) }),
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!visible.length) return null;
  return (
    <div className="relative inline-block" ref={root} onClick={(event) => event.stopPropagation()}>
      {trigger ? (
        <button
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="block cursor-pointer"
          onClick={toggle}
        >
          {trigger}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          icon={<MoreHorizontal className="size-4" />}
        />
      )}
      {position &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={position}
            onClick={(event) => event.stopPropagation()}
            className="z-[55] max-h-[70dvh] min-w-44 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
          >
            {visible.map((item) => {
              const className = `flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2 ${item.danger ? "text-bad" : "text-ink"}`;
              const content = (
                <>
                  {item.icon && <item.icon className="size-4 shrink-0" aria-hidden />}
                  {item.label}
                </>
              );
              return item.href ? (
                <Link
                  key={item.label}
                  role="menuitem"
                  href={item.href}
                  className={className}
                  onClick={() => setPosition(null)}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  className={className}
                  onClick={() => {
                    setPosition(null);
                    item.onClick?.();
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-ink-2">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-normal">{title}</h1>
          {description && <div className="mt-1 text-[13px] text-ink-2">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function DetailList({
  items,
}: {
  items: { label: string; value: ReactNode; hidden?: boolean; mono?: boolean }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-ink-3">{item.label}</dt>
            <dd className={`mt-0.5 break-words ${item.mono ? "font-mono" : ""}`}>
              {item.value || <span className="text-ink-3">Not set</span>}
            </dd>
          </div>
        ))}
    </dl>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-soft">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular w-9 text-right font-mono text-xs text-ink-2">{value}%</span>
    </div>
  );
}

export function ExternalLink({ href }: { href?: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      {href.replace(/^https?:\/\//, "")}
    </a>
  );
}
