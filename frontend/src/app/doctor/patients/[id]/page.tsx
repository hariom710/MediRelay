"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
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

export default function PatientDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<Patient>(`/patients/${params.id}`)
      .then(setPatient)
      .catch(() => setError("Could not load patient."));
    api<Prescription[]>(`/prescriptions`)
      .then((rx) => setPrescriptions(rx.filter((p) => p.patient === Number(params.id))))
      .catch(() => {});
  }, [params.id]);

  async function handleDelete() {
    if (!window.confirm("Delete this patient? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api(`/patients/${params.id}`, { method: "DELETE" });
      router.push("/doctor/patients");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete patient.");
    } finally {
      setDeleting(false);
    }
  }

  if (patient === null && !error) {
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
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">{patient?.name}</h1>
            <p className="text-sm text-ink-secondary">{patient?.email}</p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/doctor/prescriptions/new?patient=${params.id}`}>
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
          </Card>
        )}

        {patient && (
          <>
            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Details</h2>
              <dl className="divide-y divide-border space-y-0">
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Date of birth</dt>
                  <dd className="text-sm text-ink">
                    {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("en-GB") : "—"}
                  </dd>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Gender</dt>
                  <dd className="text-sm text-ink">{patient.gender || "—"}</dd>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Blood group</dt>
                  <dd className="text-sm text-ink">{patient.blood_group || "—"}</dd>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Allergies</dt>
                  <dd className="text-sm text-ink">
                    {patient.allergies || "None recorded"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-ink mb-4">Prescription history</h2>
              {prescriptions === null ? (
                <div className="px-6 py-8 text-center text-ink-secondary">Loading…</div>
              ) : prescriptions && prescriptions.length === 0 ? (
                <p className="px-6 py-8 text-center text-ink-secondary">No prescriptions.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {prescriptions.map((p) => (
                    <li key={p.id} className="px-6 py-4 flex justify-between items-start">
                      <div>
                        <p className="font-medium text-ink">RX-{p.id}</p>
                        <p className="text-xs text-ink-secondary">
                          {p.consultation_date} · v{p.version}
                        </p>
                      </div>
                      <Badge variant="neutral">{p.status}</Badge>
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
