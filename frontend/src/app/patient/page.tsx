"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">My orders</h1>
        <p className="text-sm text-ink-secondary mb-8">
          Track your prescriptions and pharmacy orders.
        </p>

        {error && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-danger">{error}</p>
            </CardContent>
          </Card>
        )}

        {orders === null && !error && (
          <div className="h-48 flex items-center justify-center rounded-lg bg-bg-elevated text-ink-secondary">
            Loading…
          </div>
        )}

        {orders && orders.length === 0 && (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-ink-secondary">No orders yet.</p>
              <p className="text-xs text-ink-tertiary mt-2">
                Ask your doctor to share a prescription, then compare prices.
              </p>
            </CardContent>
          </Card>
        )}

        {orders && orders.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-ink">Order #{o.id}</p>
                    <p className="text-xs text-ink-secondary">
                      Prescription RX-{o.prescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={o.status === "completed" ? "success" : "neutral"}
                      className="px-2 py-1"
                    >
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </Badge>
                    <span className="font-medium text-ink">₹{o.total}</span>
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
