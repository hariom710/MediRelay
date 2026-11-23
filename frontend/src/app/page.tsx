"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    title: "Digital prescriptions",
    desc: "Doctors create finalized prescriptions with structured dosage — immutable once signed.",
  },
  {
    title: "Secure share links",
    desc: "Revokable, time-limited tokens pharmacies open to see a scoped view — never full history.",
  },
  {
    title: "Transparent quotes",
    desc: "Pharmacies quote price and availability; compare single-store and multi-store options.",
  },
  {
    title: "Orders & invoices",
    desc: "FEFO stock deduction, fulfilment confirmation, and PDF invoices — audit-logged at every step.",
  },
];

export default function HomePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <main className="flex h-screen flex-col items-center justify-center bg-bg">
        <div className="h-10 w-10 rounded-full bg-border" />
      </main>
    );
  }

  if (me) {
    const portal: Record<string, string> = {
      doctor: "/doctor",
      patient: "/patient",
      pharmacy: "/pharmacy",
      admin: "/admin",
    };
    return <div className="fixed inset-0 flex items-center justify-center">
      <Card padded={false} className="w-full max-w-md p-8 shadow-md">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-ink-secondary">
            Signed in as <span className="font-semibold">{me.email}</span>
          </p>
          <p className="text-xs text-ink-tertiary">{me.active_role} portal</p>
        </div>
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            className="w-full"
          >
            <Link href={portal[me.active_role] ?? "/"}>
              Open {me.active_role} portal →
            </Link>
          </Button>
        </div>
      </Card>
    </div>;
  }

  return (
    <main className="flex h-screen flex-col bg-bg">
      <nav className="glass-nav sticky top-0 z-20">
        <div className="flex h-16 items-center justify-between px-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-ink">
            MediRelay
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-ink-secondary hover:text-accent transition-colors">
              Sign in
            </Link>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </nav>
      <div className="flex-1 px-8 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-ink leading-tight">
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
      <div className="border-t border-border bg-white/40 dark:bg-black/40">
        <div className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-2xl font-semibold text-ink mb-12">How it works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {FEATURES.map((f) => (
              <Card key={f.title} padded>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
