"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Comp: React.ElementType = asChild ? React.Fragment : "button";
  const base = "tap-interactive inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible-ring";
  const variants = {
    primary:
      "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover shadow-sm",
    secondary:
      "bg-bg-elevated border border-border text-ink hover:bg-accent/10 active:bg-accent/20",
    ghost:
      "text-ink-secondary hover:bg-accent/10 hover:text-accent active:bg-accent/20",
    danger:
      "bg-danger text-white hover:bg-red-600 active:bg-red-600",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };

  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={asChild ? undefined : disabled || loading}
      {...(asChild ? {} : props)}
    >
      {loading && (
        <span className="mr-2 h-4 w-4">↻</span>
      )}
      {children}
    </Comp>
  );
}

