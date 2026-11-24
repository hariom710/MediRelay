"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import { type Patient } from "@/lib/types";

export default function PatientsList() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Patient[]>("/patients")
      .then(setPatients)
      .catch(() => setError("Could not load active patients."));
  }, []);

  const filteredPatients = patients?.filter((p) => {
    const q = filter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.patient_code && p.patient_code.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  return (
    <Shell role="doctor">
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">My Patients</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Patients who have granted you clinical record access.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/doctor/patients/find">
                Find Patient / Request Access
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/doctor/patients/new">Register New Patient</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {/* Filter input */}
        <div className="flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or Patient ID..."
            className="w-full max-w-sm rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
          />
          {patients && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {filteredPatients?.length} of {patients.length} patient(s)
            </span>
          )}
        </div>

        {patients === null && !error && (
          <div className="flex h-48 items-center justify-center rounded-[var(--r-lg)] border border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            Loading active patients…
          </div>
        )}

        {patients && patients.length === 0 && (
          <Card className="p-12 text-center space-y-3">
            <h2 className="text-base font-bold text-[var(--text)]">No Active Patients Yet</h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              You do not have active care access to any patients. Search for existing patients to request access or redeem a 6-digit in-person code, or register a new patient.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button asChild size="sm">
                <Link href="/doctor/patients/find">Find Patient</Link>
              </Button>
              <Button variant="secondary" asChild size="sm">
                <Link href="/doctor/patients/new">Register Patient</Link>
              </Button>
            </div>
          </Card>
        )}

        {patients && patients.length > 0 && filteredPatients?.length === 0 && (
          <Card className="p-8 text-center text-xs text-[var(--text-secondary)]">
            No patients match filter “{filter}”.
          </Card>
        )}

        {filteredPatients && filteredPatients.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {filteredPatients.map((p) => {
              const scope = p.active_access?.scope || "full";
              const expiresAt = p.active_access?.expires_at
                ? new Date(p.active_access.expires_at).toLocaleDateString("en-GB")
                : null;

              return (
                <Card key={p.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[var(--accent)]/40 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/doctor/patients/${p.id}`}
                        className="font-bold text-sm text-[var(--text)] hover:text-[var(--accent)] hover:underline"
                      >
                        {p.name}
                      </Link>
                      <Badge variant="neutral" size="sm">
                        {p.patient_code || `P-${p.id}`}
                      </Badge>
                      <Badge variant={scope === "full" ? "success" : "neutral"} size="sm">
                        {scope.toUpperCase()} ACCESS
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span>{p.email}</span>
                      {p.gender && <span>Gender: {p.gender}</span>}
                      {p.blood_group && <span>Blood: {p.blood_group}</span>}
                      {expiresAt && <span>Access until: {expiresAt}</span>}
                    </div>

                    {/* Clinical highlights */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {p.allergies ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/40">
                          Allergy: {p.allergies}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-tertiary)]">No allergies</span>
                      )}
                      {p.chronic_conditions && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                          Chronic: {p.chronic_conditions}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/doctor/patients/${p.id}`}>Clinical Record</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={`/doctor/prescriptions/new?patient=${p.id}`}>
                        Prescribe →
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
