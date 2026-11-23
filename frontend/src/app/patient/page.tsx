"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import Shell from "@/components/shell";

interface Order {
  id: number;
  status: string;
  total: string;
  prescription: number;
}

export default function PatientPortal() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Order[]>("/orders/list")
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Shell role="patient">
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="type-h1 text-[var(--text)]">My Orders & Receipts</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Track prescription fulfillment status, pharmacy receipts, and order histories.
            </p>
          </div>
          <Button variant="secondary" size="sm" pill asChild>
            <Link href="/patient/prescriptions">
              View Prescriptions →
            </Link>
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20"
          >
            {error}
          </div>
        )}

        {orders === null && !error && (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-[var(--r-xl)]" />
            <Skeleton className="h-20 rounded-[var(--r-xl)]" />
          </div>
        )}

        {orders && orders.length === 0 && (
          <EmptyState
            title="No Orders Placed Yet"
            description="When you accept a quotation on one of your prescriptions, your order and tax receipt will appear here."
            action={
              <Button size="sm" pill asChild>
                <Link href="/patient/prescriptions">Browse Prescriptions</Link>
              </Button>
            }
          />
        )}

        {orders && orders.length > 0 && (
          <Card elevated className="overflow-hidden border border-[var(--border)] p-0">
            <div className="px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              Order Ledger
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]/40 transition-colors"
                >
                  <div>
                    <p className="font-bold text-sm text-[var(--text)]">
                      Order #{o.id}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Fulfilling Prescription RX-{o.prescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        o.status === "completed" || o.status === "fulfilled"
                          ? "success"
                          : o.status === "cancelled"
                          ? "cancelled"
                          : "neutral"
                      }
                    >
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </Badge>
                    <span className="font-mono font-bold text-sm text-[var(--text)]">
                      ₹{o.total}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}
