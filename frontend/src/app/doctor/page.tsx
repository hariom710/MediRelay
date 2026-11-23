"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Patient {
  id: number;
  name: string;
  email: string;
  allergies: string;
}

export default function DoctorPortal() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Patient[]>("/patients")
      .then(setPatients)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Shell role="doctor">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">My patients</h1>
            <p className="text-sm text-ink-secondary">Manage patients and create prescriptions</p>
          </div>
          <Button asChild>
            <a href="/doctor/prescriptions">New prescription →</a>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-danger">{error}</p>
            </CardContent>
          </Card>
        )}

        {patients === null && !error && (
          <div className="h-48 flex items-center justify-center rounded-lg bg-bg-elevated text-ink-secondary">
            Loading…
          </div>
        )}

        {patients && patients.length === 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>No patients yet</CardTitle>
              <CardDescription>
                Create your first patient record, then write a prescription for
                them.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {patients && patients.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
                Patient list
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {patients.map((p) => (
                  <li key={p.id} className="flex justify-between items-start px-6 py-4">
                    <div>
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-ink-secondary">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.allergies ? (
                        <Badge variant="danger" className="px-2 py-1">
                          Allergy: {p.allergies}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">No allergy on file</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}
