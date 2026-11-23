"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Quotation {
  id: number;
  prescription: number;
  status: string;
  total: string;
  validity: string;
  revision: number;
  created_at: string;
}

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Quotation[]>("/quotations")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  const STATUS_VARIANT: Record<string, string> = {
    draft: "draft",
    submitted: "finalized",
    viewed: "finalized",
    selected: "success",
    rejected: "danger",
    expired: "expired",
  };

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Quotations</h1>
            <p className="text-sm text-ink-secondary">Your quotations to patients.</p>
          </div>
          <Button asChild>
            <Link href="/pharmacy/requests">Create from request</Link>
          </Button>
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
            <p className="p-8 text-center text-ink-secondary">No quotations yet.</p>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((q) => (
                <li key={q.id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">Quotation #{q.id}</p>
                      <p className="text-xs text-ink-secondary">
                        RX-{q.prescription} · ₹{q.total} · Rev {q.revision} · {q.created_at.slice(0, 16)}
                      </p>
                    </div>
                    <Badge variant={(STATUS_VARIANT[q.status] || "neutral") as "default" | "success" | "warning" | "danger" | "neutral" | "draft" | "finalized" | "shared" | "expired" | "revoked" | "cancelled"}>
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
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

