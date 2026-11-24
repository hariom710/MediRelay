"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

const NAV: Record<string, { href: string; label: string }[]> = {
  doctor: [
    { href: "/doctor", label: "Dashboard" },
    { href: "/doctor/patients", label: "My Patients" },
    { href: "/doctor/patients/find", label: "Find Patient" },
    { href: "/doctor/prescriptions/new", label: "New Prescription" },
    { href: "/doctor/prescriptions", label: "Prescription History" },
    { href: "/doctor/notifications", label: "Notifications" },
    { href: "/doctor/profile", label: "Doctor Profile" },
  ],
  patient: [
    { href: "/patient", label: "Health & Profile" },
    { href: "/patient/doctors", label: "My Doctors & Access" },
    { href: "/patient/prescriptions", label: "Prescriptions & Quotes" },
  ],
  pharmacy: [
    { href: "/pharmacy", label: "Dispensary Desk" },
    { href: "/pharmacy/requests", label: "Rx Requests" },
    { href: "/pharmacy/quotations", label: "Quotations" },
    { href: "/pharmacy/inventory", label: "FEFO Inventory" },
    { href: "/pharmacy/orders", label: "Fulfillments" },
    { href: "/pharmacy/invoices", label: "Tax Invoices" },
    { href: "/pharmacy/notifications", label: "Alerts" },
    { href: "/pharmacy/profile", label: "Store Profile" },
  ],
  admin: [
    { href: "/admin", label: "License Verifications" },
    { href: "/admin/audit", label: "Audit Ledger" },
  ],
};

const ROLE_DISPLAY: Record<string, { label: string; variant: "default" | "success" | "warning" | "finalized" }> = {
  doctor: { label: "Doctor", variant: "finalized" },
  patient: { label: "Patient", variant: "success" },
  pharmacy: { label: "Pharmacy", variant: "warning" },
  admin: { label: "Admin", variant: "default" },
};

function NavList({
  role,
  activePath,
  onNavigate,
}: {
  role: string;
  activePath: string | null;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {(NAV[role] ?? []).map((item) => {
        const isActive = activePath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "tap-interactive flex items-center justify-between rounded-[var(--r-md)] px-3.5 py-2 text-xs font-medium transition-all select-none",
              isActive
                ? "bg-[var(--accent)] text-white shadow-xs font-semibold"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
            )}
          >
            <span>{item.label}</span>
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </Link>
        );
      })}
    </nav>
  );
}

function NavItems({ role, onNavigate }: { role: string; onNavigate: () => void }) {
  return <NavList role={role} activePath={usePathname()} onNavigate={onNavigate} />;
}

export default function Shell({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/auth/me")
      .then(async (m) => {
        if (cancelled) return;
        if (!m.roles.includes(role)) {
          router.replace("/");
        } else {
          if (m.active_role !== role) {
            try {
              const switched = await api<Me>("/auth/switch-role", {
                method: "POST",
                body: { role },
              });
              if (!cancelled) setMe(switched);
            } catch {
              if (!cancelled) setMe(m);
            }
          } else {
            setMe(m);
          }
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [role, router]);

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
  const currentBadge = ROLE_DISPLAY[role] ?? { label: role, variant: "default" };

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
          <p className="text-xs font-medium text-[var(--text-tertiary)]">
            Loading MediRelay…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-subtle)] font-sans antialiased text-[var(--text)]">
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[var(--bg-elevated)] border-b border-[var(--border)] z-40 px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--accent)] text-white font-bold text-xs">
            M
          </span>
          <span className="font-semibold tracking-tight text-sm text-[var(--text)]">
            MediRelay
          </span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="tap-interactive p-2 rounded-[var(--r-md)] border border-[var(--border)] text-[var(--text-secondary)] text-xs flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-4 h-4 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Backdrop for Mobile Menu */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] transition-transform duration-200 lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0 shadow-lg" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] text-white font-bold text-sm shadow-xs">
              M
            </span>
            <div>
              <span className="block text-sm font-bold tracking-tight text-[var(--text)]">
                MediRelay
              </span>
              <span className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Clinical Network
              </span>
            </div>
          </Link>
          <Badge variant={currentBadge.variant} size="sm">
            {currentBadge.label}
          </Badge>
        </div>

        {/* Navigation Items */}
        <Suspense fallback={<NavList role={role} activePath={null} onNavigate={() => setMobileMenuOpen(false)} />}>
          <NavItems role={role} onNavigate={() => setMobileMenuOpen(false)} />
        </Suspense>

        {/* Footer User & Role Switcher */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-subtle)]/40 space-y-3">
          <div className="px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <p className="truncate text-xs font-semibold text-[var(--text)]">
                {me?.email}
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Active role: <span className="capitalize">{role}</span>
            </p>
          </div>

          {otherRoles.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                Switch Portal
              </label>
              <select
                className="w-full appearance-none rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text)] shadow-2xs focus-visible-ring"
                value={role}
                onChange={(e) => switchRole((e.target as HTMLSelectElement).value)}
              >
                {[role, ...otherRoles].map((r) => (
                  <option key={r} value={r}>
                    Switch to {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={logout}
            className="tap-interactive w-full flex items-center justify-center rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-elevated)] py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition-all shadow-2xs"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pt-16 lg:pt-0 p-6 sm:p-8 lg:p-12 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Forced Password Change Modal */}
      {me?.must_change_password && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl space-y-4">
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                Action Required
              </span>
              <h2 className="text-lg font-bold text-[var(--text)]">Change Temporary Password</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                You are currently logged in with a temporary password. For account security, you must set a permanent password before continuing.
              </p>
            </div>

            <ChangePasswordForm onSuccess={() => setMe((prev) => (prev ? { ...prev, must_change_password: false } : null))} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { old_password: oldPassword, new_password: newPassword },
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && (
        <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-3 text-xs text-[var(--danger)] border border-[var(--danger)]/20">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[var(--text)] mb-1">
          Temporary / Current Password
        </label>
        <input
          type="password"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Enter temporary password"
          className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--text)] mb-1">
          New Password (min 8 characters)
        </label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new strong password"
          className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--text)] mb-1">
          Confirm New Password
        </label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full tap-interactive flex items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--accent)]/90 transition-all disabled:opacity-50"
      >
        {loading ? "Updating password…" : "Set Permanent Password"}
      </button>
    </form>
  );
}
