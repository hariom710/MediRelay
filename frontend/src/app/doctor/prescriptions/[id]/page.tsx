"use client";

import Link from "next/link";
import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import { type RxItem } from "@/lib/types";

interface Rx {
  id: number;
  status: string;
  version: number;
  previous_version: number | null;
  consultation_date: string;
  valid_until: string | null;
  is_expired: boolean;
  notes: string;
  signed_at: string | null;
  patient: number;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  items: RxItem[];
}

function PrescriptionDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [rx, setRx] = useState<Rx | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Rx>(`/prescriptions/${id}`)
      .then(setRx)
      .catch(() => setError("Could not load prescription."));
  }, [id]);

  async function handleFinalize() {
    if (!window.confirm("Finalize this prescription? It will become immutable.")) return;
    setBusy(true);
    try {
      const items = rx!.items.map((it) => ({ item_id: it.id, confirmed_qty: it.total_qty }));
      await api(`/prescriptions/${id}/finalize`, { method: "POST", body: { items } });
      const updated = await api<Rx>(`/prescriptions/${id}`);
      setRx(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not finalize.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    const reason = window.prompt("Reason for revision:");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/prescriptions/${id}/revise`, { method: "POST", body: { reason } });
      router.push(`/doctor/prescriptions`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not revise.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const reason = window.prompt("Reason for cancellation:");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/prescriptions/${id}/cancel`, { method: "POST", body: { reason } });
      const updated = await api<Rx>(`/prescriptions/${id}`);
      setRx(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  if (rx === null) {
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
            <h1 className="text-3xl font-bold tracking-tight text-ink">RX-{rx.id}</h1>
            <Badge variant={rx.status === "finalized" ? "success" : rx.status === "cancelled" ? "danger" : "neutral"}>
              {rx.status.toUpperCase()}
            </Badge>
            <Badge variant="neutral">v{rx.version}</Badge>
          </div>
          <p className="text-sm text-ink-secondary mt-1">
            {rx.patient_name} · Consulted {rx.consultation_date}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {rx.status === "draft" && (
            <Button onClick={handleFinalize} loading={busy} disabled={busy}>
              Finalize & sign
            </Button>
          )}
          {rx.status === "finalized" && (
            <>
              <Button asChild>
                <Link href={`/doctor/prescriptions/${id}/share`}>Share link</Link>
              </Button>
              <Button variant="secondary" onClick={handleRevise} loading={busy} disabled={busy}>
                Revise (v{rx.version + 1})
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={busy} disabled={busy}>
                Cancel prescription
              </Button>
            </>
          )}
          <Button variant="ghost" asChild>
            <a href={`/api/v1/prescriptions/${id}/pdf`} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6">
          <p className="p-4 text-sm text-danger">{error}</p>
        </Card>
      )}

      <Card className="mb-6 p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Prescribed medicines</h2>
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
    </div>
  );
}

export default function PrescriptionDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell role="doctor">
      <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading prescription…</div>}>
        <PrescriptionDetailInner params={params} />
      </Suspense>
    </Shell>
  );
}
