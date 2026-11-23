"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({
  className,
  label,
  error,
  hint,
  id,
  icon,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold tracking-tight text-[var(--text)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            "w-full h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] transition-all shadow-2xs focus-visible-ring focus:border-[var(--accent)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed",
            icon ? "pl-10" : "",
            error ? "border-[var(--danger)] focus:border-[var(--danger)]" : "",
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-[11px] text-[var(--text-tertiary)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-[var(--danger)] flex items-center gap-1"
        >
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  className,
  label,
  error,
  hint,
  id,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id || generatedId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-semibold tracking-tight text-[var(--text)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        className={cn(
          "w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] transition-all shadow-2xs focus-visible-ring focus:border-[var(--accent)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed min-h-[96px]",
          error ? "border-[var(--danger)] focus:border-[var(--danger)]" : "",
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${textareaId}-hint`} className="text-[11px] text-[var(--text-tertiary)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${textareaId}-error`}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-[var(--danger)] flex items-center gap-1"
        >
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
