"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

import { type Prescription } from "@/lib/types";

interface Dashboard {
  drafts: number;
  finalized_not_shared: number;
  active_shares: number;
  expiring_soon: number;
  recent_prescriptions: Prescription[];
  recent_patients: { id: number; name: string; allergies: string }[];
}

export default function DoctorDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/doctor/dashboard")
      .then(setData)
      .catch(() => setError("Could not load dashboard."));
  }, []);

  if (data === null && !error) {
    return (
      <Shell role="doctor">
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-8 w-8 rounded border-border" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role="doctor">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Dashboard</h1>
        <p className="text-sm text-ink-secondary mb-8">
          Overview of your prescriptions and patients.
        </p>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card padded>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
              Drafts
            </p>
            <p className="text-2xl font-bold text-ink">{data?.drafts ?? 0}</p>
          </Card>
          <Card padded>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
              Finalized, not shared
            </p>
            <p className="text-2xl font-bold text-ink">
              {data?.finalized_not_shared ?? 0}
            </p>
          </Card>
          <Card padded>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
              Active shares
            </p>
            <p className="text-2xl font-bold text-ink">{data?.active_shares ?? 0}</p>
          </Card>
          <Card padded>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
              Expiring in 7 days
            </p>
            <p className="text-2xl font-bold text-ink">{data?.expiring_soon ?? 0}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Recent prescriptions</h2>
            {data?.recent_prescriptions?.length ? (
              <ul className="divide-y divide-border">
                {data.recent_prescriptions.map((p) => (
                  <li key={p.id} className="px-6 py-4 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">RX-{p.id}</p>
                      <p className="text-xs text-ink-secondary">
                        v{p.version} · {p.status}
                      </p>
                    </div>
                    <Badge variant="neutral">{p.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-ink-secondary">
                No prescriptions yet.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Recent patients</h2>
            {data?.recent_patients?.length ? (
              <ul className="divide-y divide-border">
                {data.recent_patients.map((p) => (
                  <li key={p.id} className="px-6 py-4 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">{p.name}</p>
                      {p.allergies && (
                        <Badge variant="danger" className="mt-1 px-2 py-0.5">
                          Allergy: {p.allergies}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-ink-secondary">
                No patients yet.
              </p>
            )}
          </Card>
        </div>

        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/doctor/patients/new">New patient</Link>
          </Button>
          <Button asChild>
            <Link href="/doctor/prescriptions/new">New prescription</Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}

