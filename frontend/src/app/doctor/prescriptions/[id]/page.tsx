"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
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

export default function PrescriptionDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [rx, setRx] = useState<Rx | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Rx>(`/prescriptions/${params.id}`)
      .then(setRx)
      .catch(() => setError("Could not load prescription."));
  }, [params.id]);

  async function handleFinalize() {
    if (!window.confirm("Finalize this prescription? It will become immutable.")) return;
    setBusy(true);
    try {
      const items = rx!.items.map((it) => ({ item_id: it.id, confirmed_qty: it.total_qty }));
      await api(`/prescriptions/${params.id}/finalize`, { method: "POST", body: { items } });
      const updated = await api<Rx>(`/prescriptions/${params.id}`);
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
      await api(`/prescriptions/${params.id}/revise`, { method: "POST", body: { reason } });
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
      await api(`/prescriptions/${params.id}/cancel`, { method: "POST", body: { reason } });
      const updated = await api<Rx>(`/prescriptions/${params.id}`);
      setRx(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  if (rx === null) {
    return (
      <Shell role="doctor">
        {error ? (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="h-8 w-8 rounded border-border" />
          </div>
        )}
      </Shell>
    );
  }

  const STATUS_VARIANT: Record<string, string> = {
    draft: "draft",
    finalized: "finalized",
    revised: "finalized",
    cancelled: "cancelled",
    expired: "expired",
    shared: "shared",
    revoked: "revoked",
  };

  return (
    <Shell role="doctor">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">RX-{rx.id}</h1>
            <p className="text-sm text-ink-secondary">
              v{rx.version} · {rx.patient_name} · {rx.consultation_date}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a href={`/api/v1/prescriptions/${rx.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">Download PDF</Button>
            </a>
            {rx.status === "draft" && (
              <Button size="sm" onClick={handleFinalize} loading={busy} disabled={busy}>
                Finalize
              </Button>
            )}
            {rx.status === "finalized" && (
              <>
                <Link href={`/doctor/prescriptions/${rx.id}/share`}>
                  <Button variant="secondary" size="sm">Share Link</Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={handleRevise}>Revise</Button>
                <Button variant="danger" size="sm" onClick={handleCancel}>Cancel</Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Prescription details</h2>
          <dl className="divide-y divide-border space-y-0">
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Status</dt>
              <dd className="text-sm text-ink">
                <Badge variant={(STATUS_VARIANT[rx.status] || "neutral") as "draft" | "finalized" | "cancelled" | "expired" | "shared" | "revoked" | "danger" | "neutral" | "default" | "success" | "warning"}>
                  {rx.status.charAt(0).toUpperCase() + rx.status.slice(1)}
                </Badge>
              </dd>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Version</dt>
              <dd className="text-sm text-ink">
                v{rx.version}
                {rx.previous_version && ` (supersedes RX-${rx.previous_version})`}
              </dd>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Consultation date</dt>
              <dd className="text-sm text-ink">{rx.consultation_date}</dd>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Valid until</dt>
              <dd className="text-sm text-ink">{rx.valid_until || "—"}</dd>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Signed at</dt>
              <dd className="text-sm text-ink">{rx.signed_at || "—"}</dd>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <dt className="text-sm text-ink-secondary">Doctor</dt>
              <dd className="text-sm text-ink">{rx.doctor_name}</dd>
            </div>
          </dl>
        </Card>

        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Items</h2>
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
                <p className="text-sm text-ink">
                  Total qty: {it.total_qty} {it.dosage_form === "tablet" || it.dosage_form === "capsule" ? "tablets" : ""}
                </p>
                {it.instructions && <p className="text-sm text-ink-secondary">Note: {it.instructions}</p>}
              </li>
            ))}
          </ul>
        </Card>

        {rx.notes && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Notes</h2>
            <p className="p-4 text-sm text-ink-secondary bg-bg-elevated rounded border border-border">
              {rx.notes}
            </p>
          </Card>
        )}

        {rx.status === "finalized" && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Share</h2>
            <p className="text-sm text-ink-secondary mb-4">Share this prescription with a pharmacy.</p>
            <Button asChild>
              <Link href={`/doctor/prescriptions/${rx.id}/share`}>Create share link</Link>
            </Button>
          </Card>
        )}
      </div>
    </Shell>
  );
}
