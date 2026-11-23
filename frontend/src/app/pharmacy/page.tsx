"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Dashboard {
  new_requests: number;
  quotations_awaiting: number;
  orders_to_fulfill: number;
  low_stock: number;
  expiring_soon: number;
  recent_requests: { prescription_id: number; share_id: number; opened: boolean; expires_at: string }[];
  recent_orders: { id: number; status: string; subtotal: string; created_at: string }[];
}

export default function PharmacyDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/pharmacy/dashboard").then(setData).catch(() => setError("Could not load dashboard."));
  }, []);

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Dashboard</h1>
            <p className="text-sm text-ink-secondary">Overview of your pharmacy operations.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild><a href="/pharmacy/requests">Verify share link</a></Button>
            <Button asChild><a href="/pharmacy/inventory/add">Add stock</a></Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
          </Card>
        )}

        {data === null && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border text-ink-secondary">
            Loading…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <Card padded>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">New requests</p>
                <p className="text-2xl font-bold text-ink">{data.new_requests}</p>
              </Card>
              <Card padded>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Quotations awaiting</p>
                <p className="text-2xl font-bold text-ink">{data.quotations_awaiting}</p>
              </Card>
              <Card padded>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Orders to fulfill</p>
                <p className="text-2xl font-bold text-ink">{data.orders_to_fulfill}</p>
              </Card>
              <Card padded>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Low stock</p>
                <p className="text-2xl font-bold text-ink">{data.low_stock}</p>
              </Card>
              <Card padded>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Expiring in 30d</p>
                <p className="text-2xl font-bold text-ink">{data.expiring_soon}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4">Recent requests</h2>
                {data.recent_requests.length === 0 ? (
                  <p className="px-6 py-8 text-center text-ink-secondary">No requests yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recent_requests.map((r) => (
                      <li key={r.share_id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                        <p className="font-medium text-ink">RX-{r.prescription_id}</p>
                        <p className="text-xs text-ink-secondary">
                          {r.opened ? "Opened" : "New"} · Expires {r.expires_at.slice(0, 10)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4">Recent orders</h2>
                {data.recent_orders.length === 0 ? (
                  <p className="px-6 py-8 text-center text-ink-secondary">No orders yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recent_orders.map((o) => (
                      <li key={o.id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                        <p className="font-medium text-ink">Order #{o.id}</p>
                        <p className="text-xs text-ink-secondary">
                          {o.status} · ₹{o.subtotal} · {o.created_at.slice(0, 16)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="mt-8">
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4">Getting started</h2>
                <p className="px-6 py-4 text-sm text-ink-secondary">
                  1. Add inventory items (search the medicine catalogue).<br />
                  2. Add batches with quantity and expiry dates.<br />
                  3. Wait for prescription requests to arrive.<br />
                  4. Quote against requests using your current stock and prices.
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

