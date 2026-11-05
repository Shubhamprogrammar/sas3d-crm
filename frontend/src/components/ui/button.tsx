import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border-transparent shadow-card",
  secondary: "bg-surface text-ink border-line-strong hover:bg-surface-2 shadow-card",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink",
  danger: "bg-bad text-white dark:text-bg border-transparent hover:opacity-90 shadow-card",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 gap-2",
  icon: "h-8 w-8 justify-center",
};

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", extra = "") =>
  `inline-flex items-center justify-center rounded-lg border font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
