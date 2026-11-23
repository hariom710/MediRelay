"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Request {
  share_id: number;
  prescription_id: number;
  opened: boolean;
  expires_at: string;
}

export default function PharmacyPortal() {
  const [rows, setRows] = useState<Request[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Request[]>("/pharmacy/requests")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Prescription requests</h1>
        <p className="text-sm text-ink-secondary mb-8">
          Prescriptions shared with your pharmacy — open to quote.
        </p>

        {error && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-danger">{error}</p>
            </CardContent>
          </Card>
        )}

        {rows === null && !error && (
          <div className="h-48 flex items-center justify-center rounded-lg bg-bg-elevated text-ink-secondary">
            Loading…
          </div>
        )}

        {rows && rows.length === 0 && (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-ink-secondary">No requests yet.</p>
            </CardContent>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.share_id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-ink">RX-{r.prescription_id}</p>
                    <p className="text-xs text-ink-secondary">
                      Expires {r.expires_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={r.opened ? "success" : "neutral"}
                      className="px-2 py-1"
                    >
                      {r.opened ? "Opened" : "Unopened"}
                    </Badge>
                    <span className="text-xs font-medium text-ink-secondary">
                      Share #{r.share_id}
                    </span>
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
