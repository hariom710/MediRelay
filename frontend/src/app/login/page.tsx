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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const me = await api<Me>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.push(PORTAL_PATH[me.active_role] ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
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

      <Card elevated className="w-full max-w-md border border-[var(--border)] bg-[var(--bg-elevated)] p-8">
        <CardHeader className="text-center mb-6">
          <CardTitle as="h2" className="text-2xl">
            Sign in
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Access your secure healthcare workspace
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button type="submit" pill size="lg" className="w-full" loading={busy}>
              Sign in to MediRelay
            </Button>
          </div>
        </form>

        <div className="mt-8 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-secondary)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Create an account
          </Link>
        </div>
      </Card>
    </main>
  );
}
