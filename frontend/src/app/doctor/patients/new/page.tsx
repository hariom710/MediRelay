"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { type Patient } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Shell from "@/components/shell";

export default function NewPatient() {
  const router = useRouter();
  const [data, setData] = useState({
    name: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    phone: "",
    allergies: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const patient = await api<Patient>("/patients", {
        method: "POST",
        body: {
          name: data.name,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender,
          blood_group: data.blood_group,
          allergies: data.allergies,
        },
      });
      router.push(`/doctor/patients/${patient.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create patient.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="doctor">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">New patient</h1>
        <p className="text-sm text-ink-secondary mb-8">Create a patient record</p>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        <form onSubmit={submit} className="space-y-5">
          <Input
            label="Full name"
            required
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of birth"
              type="date"
              value={data.date_of_birth}
              onChange={(e) => setData({ ...data, date_of_birth: e.target.value })}
            />
            <Input
              label="Gender"
              value={data.gender}
              onChange={(e) => setData({ ...data, gender: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Blood group"
              value={data.blood_group}
              onChange={(e) => setData({ ...data, blood_group: e.target.value })}
            />
            <Input
              label="Phone"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
            />
          </div>
          <Input
            label="Allergies (comma separated)"
            value={data.allergies}
            onChange={(e) => setData({ ...data, allergies: e.target.value })}
          />
          <Button type="submit" className="w-full" loading={busy} disabled={busy}>
            Create patient
          </Button>
        </form>
      </div>
    </Shell>
  );
}

