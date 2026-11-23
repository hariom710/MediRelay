"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Shell from "@/components/shell";

interface Rx {
  id: number;
  status: string;
  version: number;
  consultation_date: string;
}

export default function PatientPrescriptions() {
  const [rows, setRows] = useState<Rx[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Rx[]>("/prescriptions")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Shell role="patient">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">My prescriptions</h1>
        <p className="text-sm text-ink-secondary mb-8">
          Digital prescriptions shared with you by your doctors.
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
              <p className="text-ink-secondary">No prescriptions yet.</p>
            </CardContent>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-ink">
                      Prescription RX-{r.id}
                    </p>
                    <p className="text-xs text-ink-secondary">
                      v{r.version} · {r.consultation_date.slice(0, 10)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-ink-secondary uppercase tracking-wider">
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}
