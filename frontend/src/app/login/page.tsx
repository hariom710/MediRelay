"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Activity, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ active_role: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const role = res.active_role;
      const pathMap: Record<string, string> = {
        doctor: "/doctor",
        patient: "/patient",
        pharmacy: "/pharmacy",
        admin: "/admin",
      };
      router.push(pathMap[role] ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Sign in failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBFBFD] px-6 py-12 dark:bg-black font-sans selection:bg-blue-100 selection:text-blue-900">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/25">
          <Activity className="h-6 w-6 stroke-[2.2]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          MediRelay
        </span>
      </Link>

      <div className="w-full max-w-md">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-xl border border-black/[0.06] dark:border-white/[0.08]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Sign in to access your healthcare portal
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-red-50/80 p-3.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-900/40">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                />
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                />
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tap-interactive mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 focus:outline-none disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-black/[0.06] pt-6 text-center text-xs text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
