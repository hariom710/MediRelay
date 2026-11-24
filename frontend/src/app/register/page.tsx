"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
  admin: "/admin",
};

type Role = "patient" | "doctor" | "pharmacy";

const ROLE_CHOICES: { id: Role; label: string; desc: string }[] = [
  { id: "patient", label: "Patient", desc: "Compare & order" },
  { id: "doctor", label: "Doctor", desc: "Prescribe & sign" },
  { id: "pharmacy", label: "Pharmacy", desc: "Quote & dispense" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const me = await api<Me>("/auth/register", {
        method: "POST",
        body: {
          role,
          email,
          password,
          full_name: fullName,
          ...(role === "doctor" ? { registration_number: regNumber } : {}),
          ...(role === "pharmacy" ? { pharmacy_name: pharmacyName } : {}),
        },
      });
      router.push(PORTAL_PATH[me?.active_role || role] ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-subtle)] px-4 py-12 font-sans selection:bg-[var(--accent-subtle)]">
      {/* Brand Mark */}
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] text-white font-bold text-sm shadow-xs">
          M
        </span>
        <span className="text-xl font-bold tracking-tight text-[var(--text)]">
          MediRelay
        </span>
      </Link>

      <Card elevated className="w-full max-w-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-8">
        <CardHeader className="text-center mb-6">
          <CardTitle as="h2" className="text-2xl">
            Create an Account
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Join the connected clinical healthcare network
          </CardDescription>
        </CardHeader>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] px-4 py-3 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20 flex items-center gap-2"
            >
              <span>!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Role Segmented Cards */}
          <div>
            <label className="block text-xs font-semibold tracking-tight text-[var(--text)] mb-2">
              Select Primary Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_CHOICES.map((choice) => {
                const isSelected = role === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setRole(choice.id)}
                    className={`tap-interactive flex flex-col items-center justify-center rounded-[var(--r-lg)] p-3 text-center border transition-all ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] shadow-2xs font-semibold ring-1 ring-[var(--accent)]/30"
                        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="text-xs font-bold">{choice.label}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {choice.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Full Name / Primary Contact"
            required
            placeholder={
              role === "doctor"
                ? "e.g. Dr. Sarah Jenkins"
                : role === "pharmacy"
                ? "e.g. Rajiv Mehra"
                : "e.g. Rahul Sharma"
            }
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {role === "doctor" && (
            <Input
              label="Medical Registration Number *"
              required
              placeholder="e.g. MCI-2018-98432 or MH-54321"
              hint="Required by State Medical Council / NMC for clinical signing"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
            />
          )}

          {role === "pharmacy" && (
            <Input
              label="Pharmacy Store Name *"
              required
              placeholder="e.g. Apollo Pharmacy #14"
              hint="Registered drug license dispensing name"
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
            />
          )}

          <Input
            label="Email Address"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button type="submit" pill size="lg" className="w-full" loading={busy}>
              Create {role.charAt(0).toUpperCase() + role.slice(1)} Account
            </Button>
          </div>
        </form>

        <div className="mt-8 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
