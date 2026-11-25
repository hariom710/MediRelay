"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Shell from "@/components/shell";
import { type MaskedPatientSearchResult } from "@/lib/types";

export default function FindPatientPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaskedPatientSearchResult[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [doctorVerified, setDoctorVerified] = useState<boolean | null>(null);

  useEffect(() => {
    api<Me>("/auth/me")
      .then((m) => {
        setDoctorVerified(m.verification_status === "verified");
      })
      .catch(() => {});
  }, []);

  // Code redemption state
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Request access state
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [selectedScope, setSelectedScope] = useState<"full" | "basic">("full");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setActionSuccess("");
    try {
      const data = await api<MaskedPatientSearchResult[]>(`/patients/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResults(null);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestAccess(patientId: number) {
    setRequestingId(patientId);
    setError("");
    setActionSuccess("");
    try {
      await api("/access/requests", {
        method: "POST",
        body: { patient_id: patientId, scope: selectedScope },
      });
      setActionSuccess("Access request sent. The patient will see it in their portal.");
      // Refresh search results
      const data = await api<MaskedPatientSearchResult[]>(`/patients/search?q=${encodeURIComponent(query.trim())}`);
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not request access.");
    } finally {
      setRequestingId(null);
    }
  }

  async function handleRedeemCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = codeValue.trim();
    if (cleanCode.length !== 6) {
      setCodeError("Code must be exactly 6 digits.");
      return;
    }

    setRedeeming(true);
    setCodeError("");
    try {
      const res = await api<{ care_access_id: number; patient: { id: number; name: string } }>("/access/code/redeem", {
        method: "POST",
        body: { code: cleanCode },
      });
      setCodeModalOpen(false);
      setCodeValue("");
      router.push(`/doctor/patients/${res.patient.id}`);
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : "Invalid or expired access code.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Shell role="doctor">
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Find Patient</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Search by exact Patient ID (MR-XXXXXX), 10-digit mobile number, or email.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCodeError("");
                setCodeModalOpen(true);
              }}
            >
              Enter In-Person Code
            </Button>
            <Button asChild size="sm">
              <Link href="/doctor/patients/new">Register New Patient</Link>
            </Button>
          </div>
        </div>

        {/* Doctor Verification Notice */}
        {doctorVerified === false && (
          <div className="rounded-[var(--r-md)] border border-amber-500/30 bg-amber-50/80 p-4 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ Doctor License Verification Pending</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your doctor account is currently awaiting administrative license verification. Under clinical regulations, only verified doctors can search the universal patient registry, redeem codes, or prescribe medications. Please ask an administrator to verify your account or inspect the admin queue.
            </p>
          </div>
        )}

        {/* DPDP Compliance Notice */}
        <div className="rounded-[var(--r-md)] border border-blue-500/20 bg-blue-50/50 p-4 text-xs text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
          <p className="font-semibold mb-1">Privacy & Anti-Enumeration Notice (DPDP Compliance)</p>
          <p className="text-[11px] opacity-90 leading-relaxed">
            Universal health registry lookups require an exact unique identifier. Partial name searches and patient directory browsing are strictly disabled to prevent scraping of personal health records.
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-medium text-[var(--success)] border border-[var(--success)]/20">
            {actionSuccess}
          </div>
        )}

        {/* Search Bar */}
        <Card className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. MR-A1B2C3, 9876543210, or patient@example.com"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>
              <Button type="submit" disabled={loading} loading={loading}>
                Search Patient
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Tip: Shared family mobile numbers will return masked cards for all linked family members.
            </p>
          </form>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[var(--text)]">Search Results</h2>
            {results && results.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-[var(--text)]">No patient found matching “{query}”</p>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  If this is a new patient, you can register them on their behalf and print a secure handover slip with their temporary login credentials.
                </p>
                <div className="pt-2">
                  <Button asChild size="sm">
                    <Link href="/doctor/patients/new">Register Patient Now</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results?.map((p) => (
                  <Card key={p.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text)]">{p.name}</span>
                        <Badge variant="neutral" size="sm">{p.patient_code}</Badge>
                        {p.has_active_access && (
                          <Badge variant="success" size="sm">
                            Access Granted ({p.access_scope?.toUpperCase()})
                          </Badge>
                        )}
                        {!p.has_active_access && p.access_status === "requested" && (
                          <Badge variant="warning" size="sm">
                            Access Requested
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span>Age: {p.age !== null ? `${p.age} yrs` : "N/A"}</span>
                        <span>Gender: {p.gender || "N/A"}</span>
                        <span>Phone: {p.phone_masked}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start md:self-auto">
                      {p.has_active_access ? (
                        <Button asChild size="sm">
                          <Link href={`/doctor/patients/${p.id}`}>Open Clinical Record →</Link>
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedScope}
                            onChange={(e) => setSelectedScope(e.target.value as "full" | "basic")}
                            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]"
                          >
                            <option value="full">Full Scope (All history)</option>
                            <option value="basic">Basic Scope (Summary)</option>
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={requestingId === p.id || p.access_status === "requested"}
                            loading={requestingId === p.id}
                            onClick={() => handleRequestAccess(p.id)}
                          >
                            {p.access_status === "requested" ? "Requested" : "Request Access"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setCodeError("");
                              setCodeModalOpen(true);
                            }}
                          >
                            Use 6-Digit Code
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enter Code Dialog Modal */}
        {codeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text)]">Redeem In-Person Code</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Ask the patient to tap “Generate Code” in their patient portal and enter their 6-digit code here.
                </p>
              </div>

              {codeError && (
                <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-3 text-xs text-[var(--danger)] border border-[var(--danger)]/20">
                  {codeError}
                </div>
              )}

              <form onSubmit={handleRedeemCode} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest font-mono text-2xl font-bold rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] py-3 text-[var(--text)] focus-visible-ring"
                  />
                  <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-1">
                    Valid for 10 minutes from generation.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setCodeModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={redeeming || codeValue.length !== 6}
                    loading={redeeming}
                  >
                    Verify & Grant
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
