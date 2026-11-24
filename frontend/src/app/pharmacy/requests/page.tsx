"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Request {
  share_id: number;
  prescription_id: number;
  opened: boolean;
  expires_at: string;
  status?: string;
}

interface ShareLookup {
  share_id?: number;
  prescription_id?: number;
  id?: number;
  prescription?: { id?: number };
}

export default function RequestsPage() {
  const [rows, setRows] = useState<Request[] | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Request[]>("/pharmacy/requests")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  async function verifyLink() {
    if (!token.trim()) return;
    setBusy(true);
    setVerifyError("");
    try {
      const result = await api<ShareLookup>(`/shares/${token.trim()}`);
      if (result) {
        const rxId = result.prescription_id || result.prescription?.id || result.id;
        if (!rxId) throw new Error("That link does not point to a prescription.");
        const shId = result.share_id || result.id || 0;
        const row: Request = { share_id: shId, prescription_id: rxId, opened: true, expires_at: "" };
        setRows((prev) => (prev ? [...prev, row] : [row]));
        setToken("");
      }
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Invalid or expired share link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Requests</h1>
            <p className="text-sm text-ink-secondary">Prescriptions shared with your pharmacy.</p>
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
          </Card>
        )}

        {/* Verify share link */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Verify share link</h2>
          <div className="flex gap-3">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste share token or link"
            />
            <Button onClick={verifyLink} loading={busy} disabled={busy}>
              Verify
            </Button>
          </div>
          {verifyError && <p className="mt-2 text-sm text-danger">{verifyError}</p>}
        </Card>

        {rows === null && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border text-ink-secondary">
            Loading…
          </div>
        )}

        {rows && rows.length === 0 && (
          <Card className="mb-6">
            <p className="p-8 text-center text-ink-secondary">No requests yet.</p>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.share_id}>
                  <Link
                    href={`/pharmacy/requests/${r.prescription_id}`}
                    className="block px-6 py-4 tap-interactive hover:bg-accent/5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-ink">RX-{r.prescription_id}</p>
                        <p className="text-xs text-ink-secondary">
                          Share #{r.share_id} · {r.expires_at ? `Expires ${r.expires_at.slice(0, 10)}` : "No expiry"}
                        </p>
                      </div>
                      <Badge variant={r.opened ? "success" : "neutral"}>
                        {r.opened ? "Opened" : "New"}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}

