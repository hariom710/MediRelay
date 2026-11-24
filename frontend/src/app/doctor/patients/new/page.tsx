"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { type PatientHandoverSlip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface DuplicateMatch {
  id: number;
  name: string;
  patient_code: string;
  phone_masked: string;
}

export default function NewPatient() {
  const router = useRouter();
  const [data, setData] = useState({
    name: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    phone: "",
    allergies: "",
    chronic_conditions: "",
  });

  const [overrideReason, setOverrideReason] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);

  const [handoverSlip, setHandoverSlip] = useState<PatientHandoverSlip | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await api<PatientHandoverSlip>("/patients", {
        method: "POST",
        body: {
          name: data.name.trim(),
          date_of_birth: data.date_of_birth || null,
          gender: data.gender.trim(),
          blood_group: data.blood_group.trim(),
          phone: data.phone.trim(),
          allergies: data.allergies.trim(),
          chronic_conditions: data.chronic_conditions.trim(),
          override_reason: overrideReason.trim() || undefined,
        },
      });

      // Show the printable handover slip
      setHandoverSlip(res);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "potential_duplicate") {
        setDuplicateWarning(err.message || "A patient with this phone number already exists.");
        // If details contain matches
        try {
          // err might contain details or matches if parsed
        } catch {
          // ignore
        }
      } else {
        setError(err instanceof Error ? err.message : "Could not create patient.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCopyCredentials() {
    if (!handoverSlip) return;
    const text = `MediRelay Patient Access\nPatient ID: ${handoverSlip.patient_code}\nEmail: ${handoverSlip.email}\nTemporary Password: ${handoverSlip.temp_password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Shell role="doctor">
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Register Patient</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Create a universal patient record on behalf of the patient and generate their access credentials.
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {/* Soft Duplicate Warning Banner */}
        {duplicateWarning && (
          <div className="rounded-[var(--r-md)] border border-amber-500/30 bg-amber-50/70 p-4 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold">Notice: Shared Phone Number Detected</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {duplicateWarning} In India, family members frequently share a common mobile number. If this is a separate individual (e.g. spouse, child, parent), please provide a confirmation reason below to proceed with registration.
            </p>
            <div>
              <label className="block text-[11px] font-semibold mb-1">
                Override Reason (e.g., “Spouse sharing mobile number”, “Child of primary account”)
              </label>
              <input
                type="text"
                required
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for sharing phone number"
                className="w-full rounded-[var(--r-md)] border border-amber-400/40 bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!overrideReason.trim() || busy}
                loading={busy}
                onClick={submit}
              >
                Confirm & Proceed with Registration
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDuplicateWarning(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Form */}
        {!handoverSlip && (
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Full Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={data.date_of_birth}
                    onChange={(e) => setData({ ...data, date_of_birth: e.target.value })}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Gender
                  </label>
                  <select
                    value={data.gender}
                    onChange={(e) => setData({ ...data, gender: e.target.value })}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  >
                    <option value="">Select gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Mobile Phone (10 digits) <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={data.phone}
                    onChange={(e) => setData({ ...data, phone: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210"
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Blood Group
                  </label>
                  <select
                    value={data.blood_group}
                    onChange={(e) => setData({ ...data, blood_group: e.target.value })}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  >
                    <option value="">Select blood group...</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Known Drug & Food Allergies
                </label>
                <input
                  type="text"
                  value={data.allergies}
                  onChange={(e) => setData({ ...data, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Sulfa, Peanuts (leave empty if none)"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Chronic Medical Conditions
                </label>
                <input
                  type="text"
                  value={data.chronic_conditions}
                  onChange={(e) => setData({ ...data, chronic_conditions: e.target.value })}
                  placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={busy} disabled={busy}>
                  Create Patient & Issue Credentials
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/doctor/patients">Cancel</Link>
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Printable Handover Slip */}
        {handoverSlip && (
          <div className="space-y-6">
            <div className="rounded-[var(--r-lg)] border-2 border-[var(--accent)] bg-[var(--bg-elevated)] p-8 shadow-lg space-y-6 print:border-black print:shadow-none">
              <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-[var(--accent)] text-white font-bold text-xs">
                      M
                    </span>
                    <span className="font-bold text-base text-[var(--text)]">MediRelay</span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text)] mt-2">
                    Patient Portal Access Handover Slip
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Please hand this physical slip directly to the patient.
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="finalized" size="sm">CONFIDENTIAL</Badge>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    Issued: {new Date().toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Patient Name</span>
                  <p className="text-sm font-bold text-[var(--text)] mt-0.5">{handoverSlip.name}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Universal Patient ID</span>
                  <p className="font-mono text-base font-bold text-[var(--accent)] mt-0.5">{handoverSlip.patient_code}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Login Username / Email</span>
                  <p className="font-mono font-medium text-[var(--text)] mt-0.5">{handoverSlip.email}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Portal Web Address</span>
                  <p className="font-mono text-[var(--text-secondary)] mt-0.5">
                    {typeof window !== "undefined" ? window.location.origin : "https://medirelay.local"}/login
                  </p>
                </div>
              </div>

              {/* Temporary Password Box */}
              <div className="rounded-[var(--r-md)] border-2 border-dashed border-amber-500/50 bg-amber-50/50 p-4 dark:bg-amber-950/20 text-center space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Temporary 7-Day Access Password
                </span>
                <p className="font-mono text-2xl font-black tracking-wider text-amber-950 dark:text-amber-100 select-all">
                  {handoverSlip.temp_password}
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  ⚠️ This password will expire in 7 days. You must choose a private password on your first login.
                </p>
              </div>

              <div className="text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border)] pt-4 space-y-1">
                <p>• This slip grants immediate access to your medical timeline, doctor approvals, and prescription quotes.</p>
                <p>• Keep this confidential. Do not share your login details with unauthorized individuals.</p>
              </div>
            </div>

            {/* Actions (hidden in print) */}
            <div className="flex flex-wrap items-center gap-3 print:hidden">
              <Button
                variant="secondary"
                onClick={() => window.print()}
              >
                🖨️ Print Handover Slip
              </Button>
              <Button
                variant="secondary"
                onClick={handleCopyCredentials}
              >
                {copied ? "Copied to Clipboard!" : "Copy Details"}
              </Button>
              <Button
                onClick={() => router.push(`/doctor/patients/${handoverSlip.patient_id}`)}
              >
                Proceed to Patient Record →
              </Button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
