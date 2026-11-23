"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import Shell from "@/components/shell";

interface Queue {
  doctors: { id: number; name: string; registration_number: string }[];
  pharmacies: { id: number; name: string; license_number: string }[];
}

export default function AdminPortal() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Queue>("/admin/verifications?status=pending")
      .then(setQueue)
      .catch((e) => setError(e.message));
  }, []);

  async function decide(profileType: "doctor" | "pharmacy", id: number) {
    await api(`/admin/verifications/${profileType}/${id}`, {
      method: "POST",
      body: { decision: "approve" },
    });
    setQueue((q) =>
      q
        ? {
            ...q,
            [profileType === "doctor" ? "doctors" : "pharmacies"]:
              (profileType === "doctor" ? q.doctors : q.pharmacies).filter(
                (d) => d.id !== id,
              ),
          }
        : q,
    );
  }

  const doctors = queue?.doctors ?? [];
  const pharmacies = queue?.pharmacies ?? [];

  return (
    <Shell role="admin">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Verification queue</h1>
        <p className="text-sm text-ink-secondary mb-8">
          Review and approve new doctor and pharmacy accounts.
        </p>

        {error && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-danger">{error}</p>
            </CardContent>
          </Card>
        )}

        {queue === null && !error && (
          <div className="h-48 flex items-center justify-center rounded-lg bg-bg-elevated text-ink-secondary">
            Loading…
          </div>
        )}

        {queue && doctors.length === 0 && pharmacies.length === 0 && (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-ink-secondary">Nothing pending.</p>
            </CardContent>
          </Card>
        )}

        {queue && (doctors.length > 0 || pharmacies.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-8">
            {doctors.length > 0 && (
              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
                    Doctors ({doctors.length})
                  </h2>
                </CardHeader>
                <ul className="divide-y divide-border">
                  {doctors.map((d) => (
                    <li key={d.id} className="px-6 py-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-ink">Dr. {d.name}</p>
                        <p className="text-xs text-ink-secondary">
                          {d.registration_number}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => decide("doctor", d.id)}
                      >
                        Approve
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {pharmacies.length > 0 && (
              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
                    Pharmacies ({pharmacies.length})
                  </h2>
                </CardHeader>
                <ul className="divide-y divide-border">
                  {pharmacies.map((p) => (
                    <li key={p.id} className="px-6 py-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-ink-secondary">
                          {p.license_number}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => decide("pharmacy", p.id)}
                      >
                        Approve
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

