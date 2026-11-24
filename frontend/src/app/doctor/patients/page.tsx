"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Patient {
  id: number;
  name: string;
  email: string;
  date_of_birth: string | null;
  allergies: string;
  gender: string;
  blood_group: string;
}

export default function PatientsList() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Patient[]>(`/patients?q=${encodeURIComponent(query)}`)
      .then(setPatients)
      .catch(() => setError("Could not load patients."));
  }, [query]);

  return (
    <Shell role="doctor">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Patients</h1>
            <p className="text-sm text-ink-secondary">Your patients</p>
          </div>
          <Button asChild>
            <Link href="/doctor/patients/new">New patient</Link>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        )}

        <InputSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
        />

        {patients === null && !error && (
          <div className="mt-6 flex h-48 items-center justify-center rounded-lg border border-border text-ink-secondary">
            Loading…
          </div>
        )}

        {patients && patients.length === 0 && (
          <Card className="mt-6">
            <p className="p-8 text-center text-ink-secondary">
              No patients found.
            </p>
          </Card>
        )}

        {patients && patients.length > 0 && (
          <Card className="mt-6 overflow-hidden">
            <ul className="divide-y divide-border">
              {patients.map((p) => (
                <li key={p.id} className="px-6 py-4 flex justify-between items-start hover:bg-accent/5 transition-colors">
                  <Link
                    href={`/doctor/patients/${p.id}`}
                    className="tap-interactive"
                  >
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-secondary">{p.email}</p>
                    {p.date_of_birth && (
                      <p className="text-xs text-ink-secondary">
                        {new Date(p.date_of_birth).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2">
                    {p.allergies ? (
                      <Badge variant="danger" className="px-2 py-1">
                        Allergy: {p.allergies}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">No allergy</Badge>
                    )}
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

function InputSearch({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) {
  return (
    <div className="mt-6 mb-4 w-full max-w-md">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded border border-border px-4 py-2.5 text-ink focus-visible-ring focus:ring-1 focus:ring-accent focus:border-transparent"
      />
    </div>
  );
}

