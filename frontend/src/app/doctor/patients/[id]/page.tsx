"use client";

import Link from "next/link";
import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import { type Prescription } from "@/lib/types";

interface Patient {
  id: number;
  name: string;
  email: string;
  date_of_birth: string | null;
  gender: string;
  blood_group: string;
  allergies: string;
}

function PatientDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Patient>(`/patients/${id}`)
      .then(setPatient)
      .catch(() => setError("Could not load patient."));
    api<Prescription[]>(`/prescriptions`)
      .then((rx) => setPrescriptions(rx.filter((p) => p.patient === Number(id))))
      .catch(() => {});
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("Delete this patient? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api(`/patients/${id}`, { method: "DELETE" });
      router.push("/doctor/patients");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete patient.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Shell role="doctor">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">{patient?.name}</h1>
            <p className="text-sm text-ink-secondary">{patient?.email}</p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/doctor/prescriptions/new?patient=${id}`}>
                New prescription
              </Link>
            </Button>
            {patient && (
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleting}
                disabled={deleting}
              >
                Delete patient
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        )}

        {patient === null && !error && (
          <div className="flex h-full items-center justify-center p-8">
            <div className="h-8 w-8 rounded border-border" />
          </div>
        )}

        {patient && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">Patient details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-ink-secondary uppercase tracking-wider">Date of birth</dt>
                    <dd className="text-sm font-medium text-ink">{patient.date_of_birth || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-secondary uppercase tracking-wider">Gender</dt>
                    <dd className="text-sm font-medium text-ink">{patient.gender || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-secondary uppercase tracking-wider">Blood group</dt>
                    <dd className="text-sm font-medium text-ink">{patient.blood_group || "Not set"}</dd>
                  </div>
                </dl>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">Allergies & alerts</h2>
                {patient.allergies ? (
                  <div className="rounded border border-warning/30 bg-warning/10 p-3 text-sm text-warning font-medium">
                    {patient.allergies}
                  </div>
                ) : (
                  <p className="text-sm text-ink-secondary">No known allergies recorded.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-ink mb-4">Prescriptions</h2>
          {prescriptions === null ? (
            <p className="text-sm text-ink-secondary">Loading prescriptions…</p>
          ) : prescriptions.length === 0 ? (
            <Card>
              <p className="p-6 text-sm text-ink-secondary text-center">
                No prescriptions on file for this patient.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {prescriptions.map((rx) => (
                  <li key={rx.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-ink">RX-{rx.id}</span>
                      <span className="ml-2 text-xs text-ink-secondary">
                        {rx.consultation_date} · {rx.items?.length ?? 0} item(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={rx.status === "finalized" ? "success" : rx.status === "cancelled" ? "danger" : "neutral"}>
                        {rx.status.toUpperCase()}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/doctor/prescriptions/${rx.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading patient…</div>}>
      <PatientDetailInner params={params} />
    </Suspense>
  );
}
