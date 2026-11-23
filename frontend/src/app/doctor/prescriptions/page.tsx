"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Rx {
  id: number;
  status: string;
  version: number;
  consultation_date: string;
  valid_until: string | null;
  patient: number;
  patient_name: string;
  is_expired: boolean;
}

export default function PrescriptionsList() {
  const [rows, setRows] = useState<Rx[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Rx[]>("/prescriptions")
      .then(setRows)
      .catch(() => setError("Could not load prescriptions."));
  }, []);

  const filtered = rows?.filter((r) => {
    if (filter === "draft") return r.status === "draft";
    if (filter === "finalized") return r.status === "finalized";
    if (filter === "cancelled") return r.status === "cancelled";
    if (filter === "expired") return r.is_expired;
    return true;
  }) ?? [];

  const FILTER_OPTIONS: [string, string][] = [
  ["all", "All"],
  ["draft", "Draft"],
  ["finalized", "Finalized"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
];

const STATUS_VARIANT: Record<string, string> = {
    draft: "draft",
    finalized: "finalized",
    revised: "finalized",
    cancelled: "cancelled",
    expired: "expired",
  };

  if (rows === null && !error) {
    return (
      <Shell role="doctor">
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-8 w-8 rounded border-border" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role="doctor">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Prescriptions</h1>
            <p className="text-sm text-ink-secondary">Your prescriptions</p>
          </div>
          <Button asChild>
            <Link href="/doctor/prescriptions/new">New prescription</Link>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        )}

        <div className="flex gap-2 mb-6">
          {FILTER_OPTIONS.map(([value, label]) => (
            <Button key={value} variant="ghost" size="sm" onClick={() => setFilter(value)}>
              {label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card className="mb-6">
            <p className="p-8 text-center text-ink-secondary">No prescriptions.</p>
          </Card>
        )}

        {filtered.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id} className="px-6 py-4 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => {}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">RX-{p.id}</p>
                      <p className="text-xs text-ink-secondary">
                        {p.patient_name} · v{p.version} · {p.consultation_date}
                      </p>
                    </div>
                    <Badge variant={(STATUS_VARIANT[p.status] || "neutral") as "draft" | "finalized" | "shared" | "expired" | "revoked" | "cancelled" | "neutral"}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
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

