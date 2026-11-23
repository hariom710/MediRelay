"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  pill?: boolean;
  asChild?: boolean;
}

const baseStyles =
  "tap-interactive inline-flex items-center justify-center font-medium transition-all focus-visible-ring select-none disabled:opacity-40 disabled:pointer-events-none";

const variantStyles: Record<string, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] shadow-xs active:bg-[var(--accent-hover)]",
  secondary:
    "bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] active:bg-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] active:bg-[var(--border)]",
  destructive:
    "bg-[var(--danger)] text-white hover:opacity-90 active:opacity-100 shadow-xs",
  danger:
    "bg-[var(--danger)] text-white hover:opacity-90 active:opacity-100 shadow-xs",
};

const sizeStyles: Record<string, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--r-sm)]",
  md: "h-10 px-4 text-sm gap-2 rounded-[var(--r-md)]",
  lg: "h-12 px-6 text-base gap-2.5 rounded-[var(--r-lg)]",
  xl: "h-14 px-8 text-lg gap-3 rounded-[var(--r-xl)]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  pill = false,
  disabled,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const combinedClasses = cn(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    pill ? "!rounded-full" : "",
    className
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn(combinedClasses, child.props.className),
    });
  }

  return (
    <button
      className={combinedClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="relative flex items-center justify-center">
          <span className="invisible flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-4 w-4 animate-spin text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
