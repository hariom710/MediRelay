"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ClaimProfilePage() {
  const router = useRouter();
  const [patientCode, setPatientCode] = useState("");
  const [method, setMethod] = useState<"temp_password" | "date_of_birth">("temp_password");
  const [tempPassword, setTempPassword] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api("/auth/claim", {
        method: "POST",
        body: {
          patient_code: patientCode.trim(),
          temp_password: method === "temp_password" ? tempPassword.trim() : undefined,
          date_of_birth: method === "date_of_birth" ? dob : undefined,
          email: email.trim().toLowerCase(),
          new_password: newPassword,
        },
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not claim profile. Please check credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-subtle)] px-4 py-12 font-sans selection:bg-[var(--accent-subtle)]">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] text-white font-bold text-sm shadow-xs">
          M
        </span>
        <span className="text-xl font-bold tracking-tight text-[var(--text)]">
          MediRelay
        </span>
      </Link>

      <Card elevated className="w-full max-w-md border border-[var(--border)] bg-[var(--bg-elevated)] p-8">
        <CardHeader className="text-center mb-6">
          <CardTitle as="h2" className="text-2xl">
            Claim Your Patient Record
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Did your doctor register you in clinic? Activate your account with your Patient ID and temporary slip.
          </CardDescription>
        </CardHeader>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-semibold text-[var(--success)] border border-[var(--success)]/20">
              Profile claimed successfully! Your permanent password has been set.
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              You can now sign in to view your prescriptions, approved doctors, and order history.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Sign In Now →</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] px-4 py-3 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20"
              >
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                Universal Patient ID (from handover slip)
              </label>
              <input
                type="text"
                required
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value.toUpperCase())}
                placeholder="MR-XXXXXX"
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-[var(--text)] focus-visible-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                Verification Method
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("temp_password")}
                  className={`flex-1 py-1.5 px-3 rounded-[var(--r-md)] border text-xs font-semibold transition-all ${
                    method === "temp_password"
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)]"
                  }`}
                >
                  Temporary Password
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("date_of_birth")}
                  className={`flex-1 py-1.5 px-3 rounded-[var(--r-md)] border text-xs font-semibold transition-all ${
                    method === "date_of_birth"
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)]"
                  }`}
                >
                  Date of Birth
                </button>
              </div>
            </div>

            {method === "temp_password" ? (
              <Input
                label="Temporary Password (from slip)"
                type="password"
                required
                placeholder="Enter 12-char temp password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
              />
            ) : (
              <Input
                label="Your Date of Birth"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            )}

            <Input
              label="Your Personal Email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="New Permanent Password (min 8 chars)"
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Input
              label="Confirm New Password"
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <div className="pt-2">
              <Button type="submit" pill size="lg" className="w-full" loading={busy} disabled={busy}>
                Claim & Activate Account
              </Button>
            </div>
          </form>
        )}

        <div className="mt-8 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-secondary)]">
          Already activated?{" "}
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
