"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import Shell from "@/components/shell";

interface Dashboard {
  new_requests: number;
  quotations_awaiting: number;
  orders_to_fulfill: number;
  low_stock: number;
  expiring_soon: number;
  recent_requests: {
    prescription_id: number;
    share_id: number;
    opened: boolean;
    expires_at: string;
  }[];
  recent_orders: {
    id: number;
    status: string;
    subtotal: string;
    created_at: string;
  }[];
}

export default function PharmacyDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/pharmacy/dashboard")
      .then(setData)
      .catch(() => setError("Could not load pharmacy dashboard."));
  }, []);

  return (
    <Shell role="pharmacy">
      <div className="max-w-5xl space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="type-h1 text-[var(--text)]">Dispensary Desk</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Overview of prescription requests, competitive quotations, and FEFO inventory.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" pill asChild>
              <Link href="/pharmacy/requests">Open Token Link</Link>
            </Button>
            <Button size="sm" pill asChild>
              <Link href="/pharmacy/inventory/add">+ Add Stock</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20"
          >
            <span>⚠ {error}</span>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        {data === null && !error && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-[var(--r-xl)]" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-[var(--r-2xl)]" />
              <Skeleton className="h-64 rounded-[var(--r-2xl)]" />
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card elevated className="p-4 sm:p-5 border border-[var(--border)]">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  New Requests
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-[var(--text)]">
                  {data.new_requests}
                </p>
              </Card>

              <Card elevated className="p-4 sm:p-5 border border-[var(--border)]">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Pending Quotes
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-[var(--warning)]">
                  {data.quotations_awaiting}
                </p>
              </Card>

              <Card elevated className="p-4 sm:p-5 border border-[var(--border)]">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Fulfillments
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-[var(--accent)]">
                  {data.orders_to_fulfill}
                </p>
              </Card>

              <Card elevated className="p-4 sm:p-5 border border-[var(--border)]">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Low Stock Items
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-[var(--danger)]">
                  {data.low_stock}
                </p>
              </Card>

              <Card elevated className="p-4 sm:p-5 border border-[var(--border)]">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Expiring in 30d
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-[var(--text-tertiary)]">
                  {data.expiring_soon}
                </p>
              </Card>
            </div>

            {/* Split Data Feeds */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Requests */}
              <Card elevated className="border border-[var(--border)] p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Recent Prescription Requests
                  </span>
                  <Badge variant="finalized" size="sm">
                    {data.recent_requests.length} Requests
                  </Badge>
                </div>

                {data.recent_requests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
                    No requests received yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {data.recent_requests.map((r) => (
                      <li
                        key={r.share_id}
                        className="px-6 py-3.5 flex items-center justify-between hover:bg-[var(--bg-subtle)]/40 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-sm text-[var(--text)]">
                            RX-{r.prescription_id}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            Expires {r.expires_at.slice(0, 10)}
                          </p>
                        </div>
                        <Badge variant={r.opened ? "neutral" : "success"} size="sm">
                          {r.opened ? "Opened" : "New Link"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Recent Orders */}
              <Card elevated className="border border-[var(--border)] p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Recent Customer Orders
                  </span>
                  <Badge variant="success" size="sm">
                    {data.recent_orders.length} Orders
                  </Badge>
                </div>

                {data.recent_orders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
                    No orders placed yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {data.recent_orders.map((o) => (
                      <li
                        key={o.id}
                        className="px-6 py-3.5 flex items-center justify-between hover:bg-[var(--bg-subtle)]/40 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-sm text-[var(--text)]">
                            Order #{o.id}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {o.created_at.slice(0, 10)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-[var(--text)] block">
                            ₹{o.subtotal}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
                            {o.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* FEFO Dispensary Principles Guide */}
            <Card className="border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
              <h4 className="text-sm font-bold text-[var(--text)] mb-2">
                Indian Pharmacy Compliance & FEFO Inventory Rules
              </h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                MediRelay automatically organizes stock batches by earliest expiry date. Under Section 65 of the Drugs and Cosmetics Rules, automatic brand substitution is prohibited: any generic or brand alternative must be reviewed and explicitly consented to by the patient.
              </p>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
