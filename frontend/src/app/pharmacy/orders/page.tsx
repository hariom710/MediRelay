"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Order {
  id: number;
  status: string;
  patient_name: string;
  item_count: number;
  subtotal: string;
  created_at: string;
}

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Order[]>("/orders/list")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Orders</h1>
            <p className="text-sm text-ink-secondary">Orders to fulfill.</p>
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
          </Card>
        )}

        {rows === null && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border text-ink-secondary">
            Loading…
          </div>
        )}

        {rows && rows.length === 0 && (
          <Card className="mb-6">
            <p className="p-8 text-center text-ink-secondary">No orders yet.</p>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((o) => (
                <li key={o.id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">Order #{o.id}</p>
                      <p className="text-xs text-ink-secondary">
                        {o.patient_name} · {o.item_count} items · ₹{o.subtotal} · {o.created_at.slice(0, 16)}
                      </p>
                    </div>
                    <Badge variant={o.status === "fulfilled" ? "success" : o.status === "cancelled" ? "danger" : "finalized"}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </Badge>
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

