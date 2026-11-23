"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, ChevronRight } from "lucide-react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV: Record<string, { href: string; label: string }[]> = {
  doctor: [
    { href: "/doctor", label: "Patients" },
    { href: "/doctor/prescriptions", label: "Prescriptions" },
  ],
  patient: [
    { href: "/patient", label: "Orders" },
    { href: "/patient/prescriptions", label: "Prescriptions" },
  ],
  pharmacy: [
    { href: "/pharmacy", label: "Requests" },
    { href: "/pharmacy/quotations", label: "Quotations" },
    { href: "/pharmacy/inventory", label: "Inventory" },
  ],
  admin: [
    { href: "/admin", label: "Verifications" },
    { href: "/admin/audit", label: "Audit log" },
  ],
};

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
        if (!m.roles.includes(role)) router.replace("/");
        else setMe(m);
      })
      .catch(() => router.replace("/login"));
  }, [role, router]);

  if (me === undefined || me === null) {
    return (
      <main className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 rounded-full bg-border animate-pulse" />
      </main>
    );
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  async function switchRole(r: string) {
    await api("/auth/switch-role", { method: "POST", body: { role: r } });
    router.push(NAV[r]?.[0]?.href ?? "/");
  }

  const otherRoles = me.roles.filter((r) => r !== role);
  const active = NAV[role]?.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar — glass, translucent */}
      <aside className="flex w-64 flex-col border-r border-border bg-white/70 backdrop-blur-md dark:bg-black/70 dark:border-white/10 z-10 sticky top-0 h-screen">
        <div className="flex h-12 items-center gap-3 px-6">
          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-accent">M</span>
          </div>
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-ink"
          >
            MediRelay
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {(NAV[role] ?? []).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap-interactive flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                active?.href === item.href
                  ? "bg-accent text-white shadow-sm"
                  : "text-ink-secondary hover:bg-bg-elevated/60 hover:text-accent",
              )}
            >
              <span className="w-5 text-center opacity-50">
                {item.label === "Patients" ? (
                  "👥"
                ) : item.label === "Prescriptions" ? (
                  "📋"
                ) : item.label === "Orders" ? (
                  "🧾"
                ) : item.label === "Requests" ? (
                  "📨"
                ) : item.label === "Quotations" ? (
                  "💬"
                ) : item.label === "Inventory" ? (
                  "📦"
                ) : item.label === "Verifications" ? (
                  "✅"
                ) : item.label === "Audit log" ? (
                  "📜"
                ) : (
                  "•"
                )}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="truncate px-2 text-xs text-ink-secondary">
            {me.email}
          </p>
          {otherRoles.length > 0 && (
            <select
              className="mt-2 block w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent dark:bg-black/40"
              value={role}
              onChange={(e) => switchRole(e.target.value)}
            >
              {[role, ...otherRoles].map((r) => (
                <option key={r} value={r}>
                  Switch to {r}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={logout}
            className="mt-2 w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary hover:bg-bg-elevated/60 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 lg:p-12">{children}</main>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
