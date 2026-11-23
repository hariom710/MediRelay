"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Rx {
  id: number;
  status: string;
  patient_name: string;
}

interface Share {
  id: number;
  pharmacy: number | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export default function SharePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [rx, setRx] = useState<Rx | null>(null);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newShareId, setNewShareId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Rx>(`/prescriptions/${params.id}`).then(setRx).catch(() => setError("Could not load prescription."));
    api<Share[]>(`/prescriptions/${params.id}/shares`).then(setShares).catch(() => setShares([]));
  }, [params.id]);

  const STATUS_VARIANT: Record<string, string> = {
    draft: "draft",
    finalized: "finalized",
    revised: "finalized",
    cancelled: "cancelled",
    expired: "expired",
  };

  async function createShare() {
    if (!rx) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ share: Share; token: string }>(`/prescriptions/${params.id}/shares`, {
        method: "POST",
        body: { expires_in_days: 7 },
      });
      setNewToken(res.token);
      setNewShareId(res.share.id);
      setShares((prev) => (prev ? [...prev, res.share] : [res.share]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create share.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeShare(shareId: number) {
    if (!window.confirm("Revoke this share link? It will no longer work.")) return;
    setBusy(true);
    try {
      await api(`/prescriptions/${params.id}/shares/${shareId}/revoke`, { method: "POST" });
      setShares((prev) =>
        prev ? prev.map((s) => (s.id === shareId ? { ...s, revoked_at: new Date().toISOString() } : s)) : [],
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not revoke.");
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

  return (
    <Shell role="doctor">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Share RX-{rx.id}</h1>
            <p className="text-sm text-ink-secondary">{rx.patient_name}</p>
          </div>
          <Button asChild>
            <Link href={`/doctor/prescriptions/${params.id}`}>Back to prescription</Link>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        {rx.status !== "finalized" && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">
              Only finalized prescriptions can be shared. Finalize this prescription first.
            </p>
          </Card>
        )}

        {rx.status === "finalized" && (
          <>
            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Create share link</h2>
              <p className="text-sm text-ink-secondary mb-4">
                Choose expiry (default 7 days, max 30). The link is shown once — copy it now.
              </p>
              <Button onClick={createShare} loading={busy} disabled={busy}>
                Create share link
              </Button>
              {newToken && (
                <div className="mt-4 p-4 rounded border border-border bg-bg-elevated">
                  <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wider">
                    Share link (copy now — shown once)
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={window.location.origin + `/shares/${newToken}`}
                      className="flex-1 rounded border border-border px-3 py-2 text-sm text-ink bg-bg"
                    />
                    <Button size="sm" onClick={() => navigator.clipboard.writeText(window.location.origin + `/shares/${newToken}`)}>
                      Copy
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-danger">
                    Warning: this link will not be shown again. Store it securely.
                  </p>
                </div>
              )}
            </Card>

            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Share list</h2>
              {shares && shares.length === 0 && (
                <p className="px-6 py-8 text-center text-ink-secondary">No shares yet.</p>
              )}
              {shares && shares.length > 0 && (
                <ul className="divide-y divide-border">
                  {shares.map((s) => (
                    <li key={s.id} className="px-6 py-4 flex justify-between items-start">
                      <div>
                        <p className="font-medium text-ink">
                          Share #{s.id} · {s.pharmacy ? "Targeted pharmacy" : "Open link"}
                        </p>
                        <p className="text-xs text-ink-secondary">
                          Created {s.created_at.slice(0, 16)} · Expires {s.expires_at.slice(0, 16)}
                        </p>
                        {s.revoked_at ? (
                          <p className="text-xs text-danger">Revoked {s.revoked_at.slice(0, 16)}</p>
                        ) : null}
                      </div>
                      <Badge variant={s.revoked_at ? "revoked" : "shared"}>
                        {s.revoked_at ? "Revoked" : "Active"}
                      </Badge>
                      {!s.revoked_at && (
                        <Button variant="secondary" size="sm" onClick={() => revokeShare(s.id)}>
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
