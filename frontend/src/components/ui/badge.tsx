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
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-border text-ink-secondary border border-transparent",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
    neutral: "bg-bg-elevated text-ink-secondary border border-border",
    draft: "bg-bg-elevated text-status-draft border border-status-draft/30",
    finalized: "bg-accent-muted text-accent border border-accent/30",
    shared: "bg-green/10 text-green-600 border border-green/30",
    expired: "bg-status-expired/10 text-status-expired border border-status-expired/30",
    revoked: "bg-status-revoked/10 text-status-revoked border border-status-revoked/30",
    cancelled: "bg-danger/10 text-danger border border-danger/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

