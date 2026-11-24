"use client";

import Link from "next/link";
import { useEffect, useState, use, Suspense } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface RxItem {
  id: number;
  medicine: number;
  medicine_name: string;
  strength: string;
  dosage_form: string;
  morning: number;
  afternoon: number;
  night: number;
  meal_timing: string;
  duration_days: number;
  total_qty: number;
  instructions: string;
}

interface RxDetail {
  id: number;
  consultation_date: string;
  status: string;
  version: number;
  patient_display: string;
  age: number | null;
  allergy_flag: boolean;
  items: RxItem[];
}

function RequestDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rx, setRx] = useState<RxDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<RxDetail>(`/prescriptions/${id}`)
      .then(setRx)
      .catch(() => setError("Could not load prescription."));
  }, [id]);

  if (rx === null && !error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 rounded border-border" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">RX-{rx?.id}</h1>
            <Badge variant="finalized">v{rx?.version}</Badge>
            {rx?.allergy_flag && <Badge variant="danger">Allergy Alert</Badge>}
          </div>
          <p className="text-sm text-ink-secondary mt-1">
            Patient: {rx?.patient_display} {rx?.age ? `(${rx.age} yrs)` : ""} · Consulted: {rx?.consultation_date}
          </p>
        </div>
        <Button asChild>
          <Link href={`/pharmacy/quotations/new?prescription_id=${id}`}>Create Quotation</Link>
        </Button>
      </div>

      {error && (
        <Card className="mb-6">
          <p className="p-4 text-sm text-danger">{error}</p>
        </Card>
      )}

      {rx && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Prescription Items</h2>
          <div className="divide-y divide-border">
            {rx.items.map((it) => (
              <div key={it.id} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-ink">{it.medicine_name}</p>
                  <p className="text-xs text-ink-secondary">
                    {it.dosage_form} · {it.strength} · {it.instructions}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{it.total_qty} units</p>
                  <p className="text-xs text-ink-secondary">{it.duration_days} days</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell role="pharmacy">
      <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading prescription request…</div>}>
        <RequestDetailInner params={params} />
      </Suspense>
    </Shell>
  );
}
