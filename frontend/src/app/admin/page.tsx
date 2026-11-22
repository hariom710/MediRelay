"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  ShieldCheck,
  Stethoscope,
  Building2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";

interface Queue {
  doctors: {
    id: number;
    name: string;
    registration_number: string;
    qualification?: string;
  }[];
  pharmacies: {
    id: number;
    name: string;
    license_number: string;
  }[];
}

export default function AdminPortal() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Queue>("/admin/verifications?status=pending");
      setQueue(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function decide(
    profileType: "doctor" | "pharmacy",
    id: number,
    decision: "approve" | "reject",
  ) {
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/verifications/${profileType}/${id}`, {
        method: "POST",
        body: { decision },
      });

      setSuccessMsg(
        `${profileType === "doctor" ? "Doctor" : "Pharmacy"} credential #${id} was ${decision}d.`,
      );

      setQueue((q) =>
        q
          ? {
              ...q,
              [profileType === "doctor" ? "doctors" : "pharmacies"]:
                (profileType === "doctor" ? q.doctors : q.pharmacies).filter(
                  (d) => d.id !== id,
                ),
            }
          : q,
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  const totalPending =
    (queue?.doctors.length ?? 0) + (queue?.pharmacies.length ?? 0);

  return (
    <PortalShell role="admin">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Verification & Platform Governance
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Review professional medical registrations and pharmacy licenses before authorizing platform access.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1 text-xs font-semibold text-zinc-700 dark:border-white/[0.1] dark:bg-zinc-900 dark:text-zinc-300">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          {totalPending} Pending Reviews
        </span>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-xs text-zinc-400">
          Loading verification queue…
        </div>
      ) : totalPending === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            All credentials verified
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            There are no pending doctor or pharmacy verifications at this moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Doctors Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                Doctor Registrations ({queue?.doctors.length ?? 0})
              </h2>
            </div>

            <div className="space-y-3">
              {queue?.doctors.map((d) => (
                <div
                  key={`doc-${d.id}`}
                  className="glass-panel rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                        Dr. {d.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Registration No: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{d.registration_number}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decide("doctor", d.id, "reject")}
                        className="tap-interactive rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        title="Reject Registration"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => decide("doctor", d.id, "approve")}
                        className="tap-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-500"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pharmacies Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Pharmacy Licenses ({queue?.pharmacies.length ?? 0})
              </h2>
            </div>

            <div className="space-y-3">
              {queue?.pharmacies.map((p) => (
                <div
                  key={`pharm-${p.id}`}
                  className="glass-panel rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                        {p.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Drug License No: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{p.license_number}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decide("pharmacy", p.id, "reject")}
                        className="tap-interactive rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        title="Reject License"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => decide("pharmacy", p.id, "approve")}
                        className="tap-interactive inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-500"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
