"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  className,
  label,
  error,
  id,
  icon,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={cn(
            "flex w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-ink placeholder:text-ink-tertiary focus-visible-ring focus:ring-1 focus:ring-accent focus:border-transparent disabled:bg-gray-100 disabled:text-ink-secondary",
            icon ? "pl-10" : "",
            className,
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix"> {
  label?: string;
  error?: string;
}

export function Textarea({
  className,
  label,
  error,
  id,
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "flex w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-ink placeholder:text-ink-tertiary focus-visible-ring focus:ring-1 focus:ring-accent focus:border-transparent disabled:bg-gray-100 disabled:text-ink-secondary",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

