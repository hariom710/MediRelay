"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
  admin: "/admin",
};

export default function HomePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [activeComparisonTab, setActiveComparisonTab] = useState<"single" | "multi">("single");

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent-subtle)] selection:text-[var(--accent)] flex flex-col font-sans">
      {/* 1. Functional Sticky Glass Navigation */}
      <header className="sticky top-0 z-50 w-full glass transition-all">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] text-white font-bold text-sm shadow-xs">
              M
            </span>
            <span className="text-base font-bold tracking-tight text-[var(--text)]">
              MediRelay
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            {me === undefined ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-[var(--border)]" />
            ) : me ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-xs font-medium text-[var(--text-secondary)]">
                  {me.email}
                </span>
                <Button size="sm" pill asChild>
                  <Link href={PORTAL_PATH[me.active_role] ?? "/login"}>
                    Open {me.active_role.charAt(0).toUpperCase() + me.active_role.slice(1)} Portal →
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" pill asChild>
                  <Link href="/register">Create Account</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* 2. Hero Section: Precision & Typographic Hierarchy */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 overflow-hidden border-b border-[var(--border)] bg-[var(--bg-subtle)]/40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          {/* Eyebrow Status Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-2xs mb-8">
            <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span>CDSCO & DPDP Act 2023 Compliant Infrastructure</span>
          </div>

          <h1 className="type-display text-[var(--text)] tracking-tight">
            One prescription.<br />
            Multiple pharmacies.<br />
            <span className="text-[var(--accent)]">Absolute price clarity.</span>
          </h1>

          <p className="mt-6 type-body-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            A clinical-grade marketplace bridging doctors, patients, and licensed retail pharmacies across India — with tamper-evident digital prescriptions, cryptographic privacy, and FEFO inventory deduction.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button size="lg" pill asChild className="w-full sm:w-auto">
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button variant="secondary" size="lg" pill asChild className="w-full sm:w-auto">
              <a href="#portals">Explore Portals</a>
            </Button>
          </div>

          {/* Test verification metrics */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] pt-8">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)] font-mono">156/156</span> passing test gates
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)]">FEFO</span> atomic inventory locking
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)]">SHA-256</span> scoped share tokens
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Comparison Engine Demo Card */}
      <section className="py-20 px-6 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="finalized" className="mb-3">
            Algorithmic Engine
          </Badge>
          <h2 className="type-h2 text-[var(--text)]">
            Deterministic Price Comparison
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)]">
            The platform compares submitted pharmacy quotations across two mathematically optimal purchasing models.
          </p>
        </div>

        <Card elevated className="overflow-hidden border border-[var(--border)]">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Comparison Mode:
              </span>
              <div className="inline-flex rounded-full bg-[var(--border)] p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveComparisonTab("single")}
                  className={`tap-interactive rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    activeComparisonTab === "single"
                      ? "bg-[var(--bg-elevated)] text-[var(--text)] shadow-xs font-semibold"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  Mode 1: Single Pharmacy
                </button>
                <button
                  type="button"
                  onClick={() => setActiveComparisonTab("multi")}
                  className={`tap-interactive rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    activeComparisonTab === "multi"
                      ? "bg-[var(--bg-elevated)] text-[var(--text)] shadow-xs font-semibold"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  Mode 2: Multi-Store Combo
                </button>
              </div>
            </div>

            <span className="hidden sm:inline-block text-[11px] text-[var(--text-tertiary)] font-mono">
              Prescription #RX-1049
            </span>
          </div>

          <div className="p-6 sm:p-8">
            {activeComparisonTab === "single" ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--accent-subtle)] p-5 rounded-[var(--r-xl)] border border-[var(--accent)]/20">
                  <div>
                    <Badge variant="finalized" size="sm">
                      Cheapest Single Pharmacy (100% Items Available)
                    </Badge>
                    <h4 className="mt-1.5 text-lg font-bold text-[var(--text)]">
                      MedPlus Wellness · Bandra West
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Fulfills all 3 prescribed medications under a single pickup.
                    </p>
                  </div>
                  <div className="text-right sm:border-l border-[var(--accent)]/20 sm:pl-6">
                    <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">Total Amount</p>
                    <p className="text-2xl font-bold font-mono text-[var(--accent)]">₹428.50</p>
                    <p className="text-[10px] text-[var(--success)] font-medium">Includes ₹15 handling fee</p>
                  </div>
                </div>

                <div className="divide-y divide-[var(--border)] text-xs">
                  <div className="py-2.5 flex justify-between font-semibold text-[var(--text-secondary)]">
                    <span>Item & Formulation</span>
                    <span>Pack Math & Pricing</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[var(--text)]">Amoxicillin 500mg</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">10 capsules (1 blister pack)</p>
                    </div>
                    <span className="font-mono font-medium">₹128.00</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[var(--text)]">Paracetamol 650mg</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">15 tablets (1 strip)</p>
                    </div>
                    <span className="font-mono font-medium">₹45.50</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[var(--text)]">Montelukast + Levocetirizine</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">10 tablets (1 strip)</p>
                    </div>
                    <span className="font-mono font-medium">₹240.00</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--success-subtle)] p-5 rounded-[var(--r-xl)] border border-[var(--success)]/30">
                  <div>
                    <Badge variant="success" size="sm">
                      Optimal Multi-Store Split (Maximum Savings)
                    </Badge>
                    <h4 className="mt-1.5 text-lg font-bold text-[var(--text)]">
                      Split across Apollo Pharmacy + Wellness Forever
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Calculates combination pricing across both stores including separate handling fees.
                    </p>
                  </div>
                  <div className="text-right sm:border-l border-[var(--success)]/30 sm:pl-6">
                    <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">Combined Total</p>
                    <p className="text-2xl font-bold font-mono text-[var(--success)]">₹382.00</p>
                    <p className="text-[10px] text-[var(--success)] font-semibold">Saves ₹46.50 over single store</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-[var(--r-lg)] bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-[var(--text)]">Store 1: Apollo Chemist</span>
                      <span className="font-mono font-bold">₹160.00</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-1.5">Item: Amoxicillin 500mg (₹145) + ₹15 pickup</p>
                    <span className="text-[10px] text-[var(--text-tertiary)]">1.2 km away · Ready for pickup</span>
                  </div>

                  <div className="p-4 rounded-[var(--r-lg)] bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-[var(--text)]">Store 2: Wellness Forever</span>
                      <span className="font-mono font-bold">₹222.00</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-1.5">Items: Paracetamol (₹37) + Montelukast (₹175) + ₹10 pickup</p>
                    <span className="text-[10px] text-[var(--text-tertiary)]">2.4 km away · 24/7 dispensary</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 4. The 4 Stakeholder Portals */}
      <section id="portals" className="py-20 border-t border-[var(--border)] bg-[var(--bg-subtle)]/60">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="neutral" className="mb-3">
              Role Architectures
            </Badge>
            <h2 className="type-h2 text-[var(--text)]">
              Four Connected Workspaces
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)]">
              Designed according to the exact workflow of Indian doctors, patients, retail chemists, and healthcare regulators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Card */}
            <Card interactive className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--r-lg)] bg-[var(--accent-subtle)] text-[var(--accent)] font-bold text-sm">
                    Rx
                  </span>
                  <Badge variant="finalized">Clinical Desk</Badge>
                </div>
                <CardTitle className="text-lg">Doctor Studio</CardTitle>
                <CardDescription className="mt-2">
                  Fast prescribing desk with dosage formulation math, duplicate molecule detection, allergy warnings, and immutable version chains.
                </CardDescription>
                <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">✓</span> State Medical Council Reg. Verification
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">✓</span> Tamper-evident digital signatures
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">✓</span> Instant server-side PDF generation
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <Link href="/doctor">Open Doctor Portal →</Link>
                </Button>
              </div>
            </Card>

            {/* Patient Card */}
            <Card interactive className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--r-lg)] bg-[var(--success-subtle)] text-[var(--success)] font-bold text-sm">
                    Pt
                  </span>
                  <Badge variant="success">Patient Hub</Badge>
                </div>
                <CardTitle className="text-lg">Patient Portal</CardTitle>
                <CardDescription className="mt-2">
                  Complete ownership over your prescriptions. Create ephemeral 7-day share tokens, compare quotes, and order directly.
                </CardDescription>
                <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--success)]">✓</span> Scoped tokens: private notes redacted
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--success)]">✓</span> Instant token revocation at any time
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--success)]">✓</span> Dual comparison: Single vs Multi-store
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <Link href="/patient">Open Patient Portal →</Link>
                </Button>
              </div>
            </Card>

            {/* Pharmacy Card */}
            <Card interactive className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--r-lg)] bg-[var(--warning-subtle)] text-[var(--warning)] font-bold text-sm">
                    Ph
                  </span>
                  <Badge variant="warning">Retail Chemist</Badge>
                </div>
                <CardTitle className="text-lg">Pharmacy Counter</CardTitle>
                <CardDescription className="mt-2">
                  Receive structured prescription requests, submit catalog-bound quotations, and fulfill orders with automatic FEFO batch allocation.
                </CardDescription>
                <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--warning)]">✓</span> Section 65 strict anti-substitution guards
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--warning)]">✓</span> Earliest-expiry batch inventory deduction
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--warning)]">✓</span> Itemized tax receipts & invoice PDF
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <Link href="/pharmacy">Open Pharmacy Portal →</Link>
                </Button>
              </div>
            </Card>

            {/* Admin Card */}
            <Card interactive className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--r-lg)] bg-[var(--bg-subtle)] text-[var(--text)] font-bold text-sm border border-[var(--border)]">
                    Ad
                  </span>
                  <Badge variant="neutral">Governance</Badge>
                </div>
                <CardTitle className="text-lg">Administrator Desk</CardTitle>
                <CardDescription className="mt-2">
                  Review medical registration numbers, verify pharmacy drug licenses, and inspect high-integrity append-only audit trails.
                </CardDescription>
                <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--text)]">✓</span> Medical Council credential verification
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--text)]">✓</span> Drug license 20B/21B validation queue
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--text)]">✓</span> Append-only immutable audit ledger
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <Link href="/admin">Open Admin Portal →</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. Minimalist Apple-Style Footer */}
      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[var(--text)]">MediRelay</span>
            <span>·</span>
            <span>Clinical Healthcare Network of India</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-[var(--text)] transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-[var(--text)] transition-colors">
              Register
            </Link>
            <Link href="/admin" className="hover:text-[var(--text)] transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
