"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Shell from "@/components/shell";
import { type PatientAccessCode } from "@/lib/types";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  phone: string;
  patient_code: string;
  date_of_birth: string | null;
  gender: string;
  blood_group: string;
  allergies: string;
  chronic_conditions: string;
}

interface Order {
  id: number;
  status: string;
  total: string;
  prescription_id: number;
}

export default function PatientPortal() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Quick code generation
  const [activeCode, setActiveCode] = useState<PatientAccessCode | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeScope, setCodeScope] = useState<"full" | "basic">("full");

  // Health summary editing
  const [editingSummary, setEditingSummary] = useState(false);
  const [allergiesInput, setAllergiesInput] = useState("");
  const [chronicInput, setChronicInput] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  useEffect(() => {
    // Load patient profile
    api<ProfileData>("/patient/profile")
      .then((p) => {
        setProfile(p);
        setAllergiesInput(p.allergies || "");
        setChronicInput(p.chronic_conditions || "");
      })
      .catch((e) => setError(e.message));

    // Load orders
    api<Order[]>("/orders/list")
      .then(setOrders)
      .catch(() => {});
  }, []);

  async function handleGenerateCode() {
    setGeneratingCode(true);
    setError("");
    try {
      const code = await api<PatientAccessCode>("/access/code", {
        method: "POST",
        body: { scope: codeScope, duration_minutes: 10 },
      });
      setActiveCode(code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate code.");
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleSaveSummary(e: React.FormEvent) {
    e.preventDefault();
    setSavingSummary(true);
    setError("");
    setSuccessMsg("");
    try {
      const updated = await api<ProfileData>("/patient/profile", {
        method: "PUT",
        body: {
          allergies: allergiesInput.trim(),
          chronic_conditions: chronicInput.trim(),
        },
      });
      setProfile(updated);
      setEditingSummary(false);
      setSuccessMsg("Health summary updated.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingSummary(false);
    }
  }

  return (
    <Shell role="patient">
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Health & Profile</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Your universal health passport, clinical summary, and doctor access controls.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/patient/doctors">My Doctors & Permissions →</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/patient/prescriptions">Prescriptions & Quotes</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-medium text-[var(--success)] border border-[var(--success)]/20">
            {successMsg}
          </div>
        )}

        {/* Universal Patient ID Card */}
        <div className="rounded-[var(--r-xl)] border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-subtle)] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Universal Health Passport
              </span>
              <h2 className="text-xl font-bold text-[var(--text)] mt-0.5">{profile?.name || "Patient"}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{profile?.email}</p>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)] block">
                Patient ID
              </span>
              <span className="font-mono text-xl font-black text-[var(--accent)] tracking-wider">
                {profile?.patient_code || "MR-••••••"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Phone</span>
              <p className="font-medium text-[var(--text)] mt-0.5">{profile?.phone || "Not set"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">DOB</span>
              <p className="font-medium text-[var(--text)] mt-0.5">{profile?.date_of_birth || "Not set"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Gender</span>
              <p className="font-medium text-[var(--text)] mt-0.5">{profile?.gender || "Not set"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">Blood Group</span>
              <p className="font-medium text-[var(--text)] mt-0.5">{profile?.blood_group || "Not set"}</p>
            </div>
          </div>
        </div>

        {/* 6-Digit In-Person Access Code Generator */}
        <Card className="p-6 space-y-4 border-2 border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">In-Person Doctor Access Code</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Visiting a clinic? Generate a temporary 6-digit code for the doctor to type into their system.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={codeScope}
                onChange={(e) => setCodeScope(e.target.value as "full" | "basic")}
                className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]"
              >
                <option value="full">Full Scope (Full History)</option>
                <option value="basic">Basic Scope (Summary Only)</option>
              </select>
              <Button
                size="sm"
                onClick={handleGenerateCode}
                loading={generatingCode}
                disabled={generatingCode}
              >
                Generate 6-Digit Code
              </Button>
            </div>
          </div>

          {activeCode && (
            <div className="rounded-[var(--r-md)] border border-emerald-500/40 bg-[var(--bg-elevated)] p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                Show this 6-digit code to your doctor
              </span>
              <div className="font-mono text-3xl font-black tracking-widest text-[var(--text)] select-all py-1">
                {activeCode.code}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Valid for 10 minutes ({(activeCode.scope || "full").toUpperCase()} scope). Automatically grants doctor care access.
              </p>
            </div>
          )}
        </Card>

        {/* Health Summary (Allergies & Chronic Conditions) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Clinical Alert Summary</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Allergies and chronic medical conditions visible to attending doctors.
              </p>
            </div>
            {!editingSummary ? (
              <Button variant="secondary" size="sm" onClick={() => setEditingSummary(true)}>
                Edit Health Summary
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditingSummary(false)}>
                Cancel
              </Button>
            )}
          </div>

          {!editingSummary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[var(--r-md)] border border-[var(--border)] p-4 space-y-1 bg-[var(--bg-subtle)]/50">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Allergies</span>
                <p className="text-xs font-semibold text-[var(--text)]">
                  {profile?.allergies || "No allergies recorded"}
                </p>
              </div>
              <div className="rounded-[var(--r-md)] border border-[var(--border)] p-4 space-y-1 bg-[var(--bg-subtle)]/50">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Chronic Conditions</span>
                <p className="text-xs font-semibold text-[var(--text)]">
                  {profile?.chronic_conditions || "No chronic conditions recorded"}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveSummary} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Known Allergies
                </label>
                <input
                  type="text"
                  value={allergiesInput}
                  onChange={(e) => setAllergiesInput(e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Chronic Medical Conditions
                </label>
                <input
                  type="text"
                  value={chronicInput}
                  onChange={(e) => setChronicInput(e.target.value)}
                  placeholder="e.g. Diabetes, Hypertension, Asthma"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={savingSummary} disabled={savingSummary}>
                  Save Health Summary
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Orders & Receipts Ledger */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--text)]">Recent Orders & Receipts</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/patient/prescriptions">View Prescriptions →</Link>
            </Button>
          </div>

          {orders && orders.length === 0 ? (
            <Card className="p-8 text-center text-xs text-[var(--text-secondary)]">
              No pharmacy orders placed yet.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-[var(--border)]">
                {orders?.map((o) => (
                  <li key={o.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-[var(--text)]">Order #{o.id}</span>
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">
                        Prescription RX-{o.prescription_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={o.status === "completed" || o.status === "fulfilled" ? "success" : "neutral"}
                        size="sm"
                      >
                        {o.status.toUpperCase()}
                      </Badge>
                      <span className="font-mono font-bold text-xs text-[var(--text)]">
                        ₹{o.total}
                      </span>
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
