"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "@/lib/api";
import {
  Users,
  FileText,
  Building2,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Activity,
  ShoppingBag,
  FolderHeart,
  FlaskConical,
  Sparkles,
  Bell,
  Users2,
} from "lucide-react";

const NAV: Record<
  string,
  { href: string; label: string; icon: React.ElementType }[]
> = {
  doctor: [
    { href: "/doctor", label: "Prescription Studio", icon: Users },
  ],
  patient: [
    { href: "/patient", label: "My Orders & Bills", icon: ShoppingBag },
    { href: "/patient/prescriptions", label: "Prescriptions & Quotes", icon: FileText },
  ],
  pharmacy: [
    { href: "/pharmacy", label: "Prescription Requests", icon: Building2 },
  ],
  admin: [
    { href: "/admin", label: "Verifications", icon: ShieldCheck },
  ],
};

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  doctor: { label: "Doctor", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  patient: { label: "Patient", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  pharmacy: { label: "Pharmacy", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  admin: { label: "Administrator", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
};

/** Apple-inspired portal shell with extended navigation and role switching */
export default function PortalShell({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>("/auth/me")
      .then((m) => {
        if (!m.roles.includes(role)) {
          router.replace("/");
        } else {
          setMe(m);
        }
      })
      .catch(() => router.replace("/login"));
  }, [role, router]);

  if (me === undefined || me === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD] dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
          <p className="text-xs font-medium tracking-wide text-zinc-400">Loading MediRelay…</p>
        </div>
      </div>
    );
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  async function switchRole(r: string) {
    await api("/auth/switch-role", { method: "POST", body: { role: r } });
    const path = NAV[r]?.[0]?.href ?? "/";
    router.push(path);
  }

  const otherRoles = me.roles.filter((r) => r !== role);
  const badge = ROLE_BADGE[role] ?? { label: role, color: "bg-zinc-100 text-zinc-700" };

  return (
    <div className="flex min-h-screen bg-[#FBFBFD] dark:bg-black font-sans text-zinc-900 dark:text-zinc-100">
      {/* Sleek Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-black/[0.06] bg-white/80 p-5 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-zinc-950/80">
        <div className="flex items-center justify-between pb-6 pt-1">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Activity className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">MediRelay</span>
              <span className="block text-[10px] font-medium tracking-widest text-zinc-400 uppercase">Healthcare</span>
            </div>
          </Link>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-1 pt-1 overflow-y-auto">
          {(NAV[role] ?? []).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tap-interactive flex items-center gap-3 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white dark:text-zinc-900" : "text-zinc-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Switcher */}
        <div className="border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
          <div className="rounded-xl bg-zinc-50/80 p-3 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{me.email}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Active: {role}</span>
            </div>

            {otherRoles.length > 0 && (
              <div className="mt-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Switch Portal
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    value={role}
                    onChange={(e) => switchRole(e.target.value)}
                  >
                    {[role, ...otherRoles].map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)} Portal
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-zinc-400" />
                </div>
              </div>
            )}

            <button
              onClick={logout}
              className="tap-interactive mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 p-8 lg:p-10 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
