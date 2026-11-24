"use client";

import Link from "next/link";
import { useEffect, useState, use, Suspense } from "react";
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

function SharePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rx, setRx] = useState<Rx | null>(null);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Rx>(`/prescriptions/${id}`).then(setRx).catch(() => setError("Could not load prescription."));
    api<Share[]>(`/prescriptions/${id}/shares`).then(setShares).catch(() => setShares([]));
  }, [id]);

  async function createShare() {
    if (!rx) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ share: Share; token: string }>(`/prescriptions/${id}/shares`, {
        method: "POST",
        body: { expires_in_days: 7 },
      });
      setNewToken(res.token);
      setCopied(false);
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
      await api(`/prescriptions/${id}/shares/${shareId}/revoke`, { method: "POST" });
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
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 rounded border-border" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Share RX-{rx.id}</h1>
          <p className="text-sm text-ink-secondary">{rx.patient_name}</p>
        </div>
        <Button asChild>
          <Link href={`/doctor/prescriptions/${id}`}>Back to prescription</Link>
        </Button>
      </div>

      {error && (
        <Card className="mb-6">
          <p className="p-4 text-sm text-danger">{error}</p>
        </Card>
      )}

      {newToken && (
        <Card className="mb-6 p-6 border-success bg-success/5">
          <h2 className="text-base font-semibold text-success mb-2">Share link created!</h2>
          <p className="text-xs text-ink-secondary mb-3">Copy this secure token or URL:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/shares/${newToken}`}
              className="flex-1 rounded border border-border bg-white px-3 py-2 text-xs font-mono select-all"
            />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/shares/${newToken}`);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Active share links</h2>
          <Button onClick={createShare} loading={busy} disabled={busy} size="sm">
            Generate new link
          </Button>
        </div>
        {shares && shares.length > 0 ? (
          <div className="divide-y divide-border">
            {shares.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono">Share #{s.id}</span>
                  <span className="ml-2 text-ink-secondary">Expires: {s.expires_at.slice(0, 10)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.revoked_at ? "danger" : "success"}>
                    {s.revoked_at ? "Revoked" : "Active"}
                  </Badge>
                  {!s.revoked_at && (
                    <Button variant="danger" size="sm" onClick={() => revokeShare(s.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-secondary">No share links generated yet.</p>
        )}
      </Card>
    </div>
  );
}

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell role="doctor">
      <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading share details…</div>}>
        <SharePageInner params={params} />
      </Suspense>
    </Shell>
  );
}
