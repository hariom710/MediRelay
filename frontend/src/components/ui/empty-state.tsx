"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--r-2xl)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 p-8 sm:p-12 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[var(--r-xl)] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-tertiary)] shadow-2xs">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold tracking-tight text-[var(--text)]">
        {title}
      </h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
