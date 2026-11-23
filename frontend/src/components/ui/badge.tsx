"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "neutral";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-border text-ink-secondary border border-transparent",
    success:
      "bg-success/10 text-success border border-success/20",
    warning:
      "bg-warning/10 text-warning border border-warning/20",
    danger:
      "bg-danger/10 text-danger border border-danger/20",
    neutral:
      "bg-bg-elevated text-ink-secondary border border-border",
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
