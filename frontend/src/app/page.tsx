"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Building2,
  Stethoscope,
  TrendingDown,
  Sparkles,
  Lock,
  RefreshCw,
  QrCode,
  CheckCircle2,
} from "lucide-react";

const PORTAL_PATH: Record<string, string> = {
  doctor: "/doctor",
  patient: "/patient",
  pharmacy: "/pharmacy",
  admin: "/admin",
};

export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Floating Glass Navigation */}
      <header className="sticky top-0 z-50 w-full glass-nav px-6 lg:px-12 py-3.5 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <Activity className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              MediRelay
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {me === undefined ? (
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ) : me ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-xs font-medium text-zinc-500">
                  {me.email}
                </span>
                <Link
                  href={PORTAL_PATH[me.active_role] ?? "/login"}
                  className="tap-interactive inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  Open {me.active_role.charAt(0).toUpperCase() + me.active_role.slice(1)} Portal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="tap-interactive rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="tap-interactive rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-500 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-24">
        {/* Subtle background ambient gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-200/40 via-indigo-100/30 to-purple-100/20 blur-3xl dark:from-blue-900/15 dark:via-indigo-900/10 dark:to-purple-900/10" />

        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3.5 py-1 text-xs font-medium text-zinc-600 backdrop-blur-md shadow-xs dark:border-white/[0.1] dark:bg-zinc-900/70 dark:text-zinc-300 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            <span>Next-Generation Healthcare & Prescription Ecosystem</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.08]">
            One prescription. <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Multiple pharmacies.
            </span> <br />
            Transparent prices.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
            A unified network connecting doctors, verified pharmacies, and patients. Create digital prescriptions, receive real-time pharmacy stock quotes, and save up to 40% with smart combination pricing.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="tap-interactive inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all"
            >
              Start using MediRelay
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="tap-interactive inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 px-7 py-3.5 text-sm font-semibold text-zinc-800 shadow-xs hover:bg-zinc-50 dark:border-white/[0.1] dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign into existing account
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Pillars: Apple 3-Column Glass Grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Doctors */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-6">
              <Stethoscope className="h-6 w-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
              Doctors
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Generate structured, tamper-proof digital prescriptions with built-in catalogue search, dosage schedules, and instant QR & share links.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Verified credentials</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 2: Pharmacies */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 mb-6">
              <Building2 className="h-6 w-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
              Pharmacies
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Receive scoped prescription requests, submit real-time batch quotations, and manage FEFO inventory without unnecessary manual paperwork.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span>Licensed fulfillment</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 3: Patients & Optimizer */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-6">
              <TrendingDown className="h-6 w-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
              Patients & Price Engine
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Compare quotes side-by-side. Our engine calculates the cheapest complete pharmacy and optimal multi-store combinations with fees included.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Transparent savings</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Compliance Badge Bar */}
      <section className="mt-auto border-t border-black/[0.06] bg-white/50 py-8 backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-950/50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-6 px-6 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-zinc-400" />
            <span>End-to-End Scoped Consent</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-zinc-400" />
            <span>Immutable Prescription Audit Trail</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <span>FEFO Stock Verification</span>
          </div>
        </div>
      </section>
    </div>
  );
}
