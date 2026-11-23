"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "neutral"
    | "draft"
    | "finalized"
    | "shared"
    | "expired"
    | "revoked"
    | "cancelled";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const variants: Record<string, string> = {
    default:
      "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)]",
    neutral:
      "bg-[var(--bg-subtle)] text-[var(--text)] border-[var(--border-strong)]",
    success:
      "bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/30",
    warning:
      "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/30",
    danger:
      "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/30",
    draft:
      "bg-[var(--bg-subtle)] text-[var(--status-draft)] border-[var(--border)]",
    finalized:
      "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/30",
    shared:
      "bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/30",
    expired:
      "bg-[var(--bg-subtle)] text-[var(--status-expired)] border-[var(--border)]",
    revoked:
      "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/30",
    cancelled:
      "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/30",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight uppercase select-none",
        variants[variant] || variants.default,
        sizes[size],
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}
