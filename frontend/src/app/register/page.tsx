"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, User, Stethoscope, Building2 } from "lucide-react";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
};

type Role = "patient" | "doctor" | "pharmacy";

const ROLE_CHOICES: [Role, string][] = [
  ["patient", "Patient"],
  ["doctor", "Doctor"],
  ["pharmacy", "Pharmacy"],
];

const ROLE_LABELS: Record<Role, { label: string; desc: string; icon: React.ReactNode }> = {
  patient: {
    label: "Patient",
    desc: "Receive prescriptions, compare pharmacy prices, order medicines.",
    icon: <User className="h-5 w-5" />,
  },
  doctor: {
    label: "Doctor",
    desc: "Create digital prescriptions and share them securely with pharmacies.",
    icon: <Stethoscope className="h-5 w-5" />,
  },
  pharmacy: {
    label: "Pharmacy",
    desc: "Quote availability and prices, fulfil orders, issue invoices.",
    icon: <Building2 className="h-5 w-5" />,
  },
};

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
      await api<Me>("/auth/register", {
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
      router.push(PORTAL_PATH[role] ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="flex flex-col items-center gap-1 mb-8">
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-accent">M</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Create account</h2>
          <p className="text-sm text-ink-secondary">Join MediRelay</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger border border-danger/20">
              {error}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {ROLE_CHOICES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value as Role)}
                className={`tap-interactive flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm transition-colors ${
                  role === value
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-bg-elevated border-border text-ink-secondary hover:border-accent hover:text-accent"
                }`}
              >
                {ROLE_LABELS[value as Role].icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
          <Input
            label="Full name"
            required
            icon={<User className="h-4 w-4 text-ink-secondary" />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            icon={<Mail className="h-4 w-4 text-ink-secondary" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {role === "doctor" && (
            <Input
              label="Registration number"
              placeholder="e.g. MH-12345"
              icon={<Stethoscope className="h-4 w-4 text-ink-secondary" />}
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
            />
          )}
          {role === "pharmacy" && (
            <Input
              label="Pharmacy name"
              icon={<Building2 className="h-4 w-4 text-ink-secondary" />}
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
            />
          )}
          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            icon={<Lock className="h-4 w-4 text-ink-secondary" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={busy}>
            Create account
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-ink-secondary">
          Already registered?{" "}
          <a
            href="/login"
            className="font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Sign in
          </a>
        </p>
      </Card>
    </main>
  );
}
