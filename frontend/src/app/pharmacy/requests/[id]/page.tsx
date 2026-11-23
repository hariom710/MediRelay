"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
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

export default function RequestDetail({ params }: { params: { id: string } }) {
  const [rx, setRx] = useState<RxDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The share token comes from the URL or is passed as a param
    // For now, we'll try to fetch by prescription id
    api<RxDetail>(`/prescriptions/${params.id}`)
      .then(setRx)
      .catch(() => setError("Could not load prescription."));
  }, [params.id]);

  if (rx === null && !error) {
    return (
      <Shell role="pharmacy">
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-8 w-8 rounded border-border" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role="pharmacy">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">RX-{rx?.id}</h1>
            <p className="text-sm text-ink-secondary">
              {rx?.patient_display} · {rx?.consultation_date} · v{rx?.version}
            </p>
          </div>
          <Button asChild>
            <Link href={`/pharmacy/quotations/new?rx=${rx?.id}`}>Create quotation</Link>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        {rx && (
          <>
            {rx.allergy_flag && (
              <Card className="mb-6">
                <p className="p-4 text-sm text-danger">Patient has recorded allergies. Check before dispensing.</p>
              </Card>
            )}

            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Prescription items</h2>
              <ul className="divide-y divide-border">
                {rx.items.map((it) => (
                  <li key={it.id} className="px-6 py-4">
                    <p className="font-medium text-ink">{it.medicine_name}</p>
                    <p className="text-sm text-ink-secondary">
                      {it.strength} · {it.dosage_form} ·
                      M {it.morning} / A {it.afternoon} / N {it.night} ·
                      {it.meal_timing.replace(/_/g, " ")} ·
                      {it.duration_days} days
                    </p>
                    <p className="text-sm text-ink">Total qty: {it.total_qty}</p>
                    {it.instructions && <p className="text-sm text-ink-secondary">Note: {it.instructions}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}