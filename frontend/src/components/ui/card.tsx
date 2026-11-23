"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
  elevated?: boolean;
}

export function Card({
  className,
  padded = true,
  interactive = false,
  elevated = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--r-2xl)] border border-[var(--border)] bg-[var(--bg-elevated)] transition-all",
        elevated ? "shadow-md" : "shadow-xs",
        interactive &&
          "tap-interactive cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--border-strong)]",
        padded ? "p-6 sm:p-7" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "span";
  children?: React.ReactNode;
}

export function CardTitle({
  as: Component = "h3",
  className,
  children,
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={cn(
        "text-base font-semibold tracking-tight text-[var(--text)]",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={cn("text-xs text-[var(--text-secondary)] leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        "mt-6 flex items-center gap-3 pt-4 border-t border-[var(--border)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
