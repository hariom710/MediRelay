"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import Shell from "@/components/shell";

interface Queue {
  doctors: { id: number; name: string; registration_number: string }[];
  pharmacies: { id: number; name: string; license_number: string }[];
}

export default function AdminPortal() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api<Queue>("/admin/verifications?status=pending")
      .then(setQueue)
      .catch((e) => setError(e.message));
  }, []);

  async function decide(profileType: "doctor" | "pharmacy", id: number) {
    setBusyId(`${profileType}-${id}`);
    try {
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
                  (d) => d.id !== id
                ),
            }
          : q
      );
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const doctors = queue?.doctors ?? [];
  const pharmacies = queue?.pharmacies ?? [];

  return (
    <Shell role="admin">
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="type-h1 text-[var(--text)]">Credential Verification Queue</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Validate State Medical Council registrations and retail drug licenses before permitting clinical actions.
            </p>
          </div>
          <Badge variant="neutral" size="md">
            Admin Authority Active
          </Badge>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20"
          >
            {error}
          </div>
        )}

        {queue === null && !error && (
          <div className="grid sm:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-[var(--r-2xl)]" />
            <Skeleton className="h-64 rounded-[var(--r-2xl)]" />
          </div>
        )}

        {queue && doctors.length === 0 && pharmacies.length === 0 && (
          <EmptyState
            title="Verification Queue Clear"
            description="All registered doctors and retail pharmacies have been reviewed and approved. New registrations will automatically appear here."
          />
        )}

        {queue && (doctors.length > 0 || pharmacies.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-6">
            {doctors.length > 0 && (
              <Card elevated className="border border-[var(--border)] p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Pending Doctors
                  </span>
                  <Badge variant="finalized" size="sm">
                    {doctors.length} Pending
                  </Badge>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {doctors.map((d) => (
                    <li
                      key={d.id}
                      className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[var(--bg-subtle)]/40 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-sm text-[var(--text)]">
                          Dr. {d.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                          Reg: {d.registration_number || "Pending"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        pill
                        loading={busyId === `doctor-${d.id}`}
                        onClick={() => decide("doctor", d.id)}
                      >
                        Approve License
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {pharmacies.length > 0 && (
              <Card elevated className="border border-[var(--border)] p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Pending Pharmacies
                  </span>
                  <Badge variant="warning" size="sm">
                    {pharmacies.length} Pending
                  </Badge>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {pharmacies.map((p) => (
                    <li
                      key={p.id}
                      className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[var(--bg-subtle)]/40 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-sm text-[var(--text)]">
                          {p.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                          Drug Lic: {p.license_number || "Pending"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        pill
                        loading={busyId === `pharmacy-${p.id}`}
                        onClick={() => decide("pharmacy", p.id)}
                      >
                        Approve License
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
