"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV: Record<string, { href: string; label: string }[]> = {
  doctor: [
    { href: "/doctor", label: "Dashboard" },
    { href: "/doctor/patients", label: "Patients" },
    { href: "/doctor/prescriptions/new", label: "New prescription" },
    { href: "/doctor/prescriptions", label: "Prescriptions" },
    { href: "/doctor/notifications", label: "Notifications" },
    { href: "/doctor/profile", label: "Profile" },
  ],
  patient: [
    { href: "/patient", label: "Orders" },
    { href: "/patient/prescriptions", label: "Prescriptions" },
  ],
  pharmacy: [
    { href: "/pharmacy", label: "Dashboard" },
    { href: "/pharmacy/requests", label: "Requests" },
    { href: "/pharmacy/quotations", label: "Quotations" },
    { href: "/pharmacy/inventory", label: "Inventory" },
    { href: "/pharmacy/orders", label: "Orders" },
    { href: "/pharmacy/invoices", label: "Invoices" },
    { href: "/pharmacy/notifications", label: "Notifications" },
    { href: "/pharmacy/profile", label: "Profile" },
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
  const [pathname] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") return window.location.pathname;
    return undefined;
  });
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/auth/me")
      .then((m) => {
        if (cancelled) return;
        if (!m.roles.includes(role)) {
          router.replace("/");
        } else {
          setTimeout(() => {
            if (!cancelled) setMe(m);
          }, 0);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => { cancelled = true; };
  }, [role, router]);

  if (pathname === undefined) {
    return <div className="h-8 w-8 rounded border-border" />;
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  async function switchRole(r: string) {
    await api("/auth/switch-role", {
      method: "POST",
      body: { role: r },
    });
    router.push(NAV[r]?.[0]?.href ?? "/");
  }

  const otherRoles = me?.roles.filter((r) => r !== role) ?? [];
  const active = NAV[role]?.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside
        className="flex w-64 flex-col border-r border-border bg-bg-elevated z-10 sticky top-0 h-screen"
      >
        <div className="flex h-12 items-center gap-3 px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-ink">
            MediRelay
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {(NAV[role] ?? []).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap-interactive flex items-center rounded px-3 py-2 text-sm transition-colors",
                active?.href === pathname ? "bg-accent text-white" : "text-ink-secondary hover:bg-accent/10 hover:text-accent",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="truncate px-2 text-xs text-ink-secondary">{me?.email}</p>
          {otherRoles.length > 0 && (
            <select
              className="mt-2 block w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-ink-secondary focus-visible-ring focus:ring-1 focus:ring-accent"
              value={role}
              onChange={(e) => switchRole((e.target as HTMLSelectElement).value)}
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
            className="mt-2 w-full flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-ink-secondary hover:bg-accent/10 transition-colors"
          >
            Sign out
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

