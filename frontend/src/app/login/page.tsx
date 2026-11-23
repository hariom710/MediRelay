"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
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
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md shadow-md">
        <div className="flex flex-col items-center gap-1 mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Sign in</h2>
          <p className="text-sm text-ink-secondary">Welcome back to MediRelay</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger border border-danger/20">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-ink-secondary">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Create one
          </a>
        </p>
      </Card>
    </main>
  );
}

