"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
  admin: "/admin",
};

export default function HomePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return <main className="flex h-screen flex-col items-center justify-center bg-bg" />;
  }

  if (me) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-md">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-ink-secondary">
              Signed in as <span className="font-semibold">{me.email}</span>
            </p>
            <p className="text-xs text-ink-tertiary">{me.active_role} portal</p>
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild className="w-full">
              <Link href={PORTAL_PATH[me.active_role] ?? "/"}>
                Open {me.active_role} portal
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-bg">
      <nav className="border-b border-border sticky top-0 bg-bg/80 backdrop-blur-none z-20">
        <div className="flex h-12 items-center justify-between px-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-ink">
            MediRelay
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-ink-secondary hover:text-accent">
              Sign in
            </Link>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </nav>
      <div className="flex-1 px-8 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink leading-tight">
            One prescription.<br />
            Multiple pharmacies.<br />
            Transparent prices.
          </h1>
          <p className="mt-6 text-xl text-ink-secondary max-w-xl mx-auto leading-relaxed">
            Connect doctors, patients, and pharmacies with secure digital
            prescriptions and real price comparison.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild className="px-8">
              <Link href="/register">Get started</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

