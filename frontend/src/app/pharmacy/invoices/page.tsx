"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Invoice {
  id: number;
  order?: number;
  order_id?: number;
  patient?: string;
  patient_name?: string;
  total: string;
  payment_status: string;
  created_at?: string;
  issued_at?: string;
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Invoice[]>("/pharmacy/invoices")
      .then(setRows)
      .catch(() => setError("Could not load invoices."));
  }, []);

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Invoices</h1>
            <p className="text-sm text-ink-secondary">Invoices issued for fulfilled orders.</p>
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
            <p className="p-8 text-center text-ink-secondary">No invoices yet.</p>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((inv) => (
                <li key={inv.id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">Invoice #{inv.id}</p>
                      <p className="text-xs text-ink-secondary">
                        Order #{inv.order ?? inv.order_id} · {inv.patient ?? inv.patient_name ?? "Patient"} · ₹{inv.total} · {(inv.created_at || inv.issued_at || "").slice(0, 16)}
                      </p>
                    </div>
                    <Badge variant={inv.payment_status === "paid" ? "success" : inv.payment_status === "failed" ? "danger" : "neutral"}>
                      {inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}
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

