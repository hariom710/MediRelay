"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  className,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-lg border-border bg-bg-elevated",
        padded ? "p-6" : "",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold tracking-tight text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}
export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-ink-secondary", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn("pt-1", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn("mt-6 flex items-center gap-3 pt-4 border-t border-border", className)}
      {...props}
    >
      {children}
    </div>
  );
}
