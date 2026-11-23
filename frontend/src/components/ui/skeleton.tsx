"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
}

export function Skeleton({
  className,
  rounded = "md",
  ...props
}: SkeletonProps) {
  const roundedClasses = {
    sm: "rounded-[var(--r-sm)]",
    md: "rounded-[var(--r-md)]",
    lg: "rounded-[var(--r-lg)]",
    xl: "rounded-[var(--r-2xl)]",
    full: "rounded-full",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--border)]",
        roundedClasses[rounded],
        className
      )}
      {...props}
    />
  );
}
