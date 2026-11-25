"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Shell from "@/components/shell";
import { type DoctorProfile, type PharmacyProfile } from "@/lib/types";

interface QueueResponse {
  doctors: DoctorProfile[];
  pharmacies: PharmacyProfile[];
}

type StatusFilter = "all" | "pending" | "verified" | "under_review" | "rejected" | "suspended";

export default function AdminPortal() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTab, setActiveTab] = useState<"all" | "doctors" | "pharmacies">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Note dialog state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<{ type: "doctor" | "pharmacy"; id: number; name: string; decision: string } | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    loadData(statusFilter);
  }, [statusFilter]);

  async function loadData(st: StatusFilter) {
    setLoading(true);
    setError("");
    try {
      const res = await api<QueueResponse>(`/admin/verifications?status=${st}`);
      setData(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeDecision(profileType: "doctor" | "pharmacy", id: number, decision: string, note = "") {
    setBusyId(`${profileType}-${id}`);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/admin/verifications/${profileType}/${id}`, {
        method: "POST",
        body: { decision, note },
      });
      setSuccessMsg(`Successfully updated ${profileType} status to ${decision}.`);
      setNoteModalOpen(false);
      setTargetItem(null);
      setNoteText("");
      await loadData(statusFilter);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function openActionWithNote(type: "doctor" | "pharmacy", id: number, name: string, decision: string) {
    if (decision === "approve") {
      executeDecision(type, id, decision);
    } else {
      setTargetItem({ type, id, name, decision });
      setNoteText("");
      setNoteModalOpen(true);
    }
  }

  const allDoctors = data?.doctors || [];
  const allPharmacies = data?.pharmacies || [];

  const filteredDoctors = allDoctors.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.name || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.registration_number || "").toLowerCase().includes(q) ||
      (d.clinic_name || "").toLowerCase().includes(q) ||
      (d.qualification || "").toLowerCase().includes(q)
    );
  });

  const filteredPharmacies = allPharmacies.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.pharmacy_name || p.name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.license_number || p.licence_number || "").toLowerCase().includes(q) ||
      (p.city || "").toLowerCase().includes(q) ||
      (p.contact_person || "").toLowerCase().includes(q)
    );
  });

  function getStatusBadge(st: string) {
    switch (st) {
      case "verified":
        return <Badge variant="success">VERIFIED / APPROVED</Badge>;
      case "pending":
        return <Badge variant="warning">PENDING REVIEW</Badge>;
      case "under_review":
        return <Badge variant="neutral">UNDER REVIEW</Badge>;
      case "rejected":
      case "suspended":
        return <Badge variant="danger">{st.toUpperCase()}</Badge>;
      default:
        return <Badge variant="neutral">{st.toUpperCase()}</Badge>;
    }
  }

  const totalCount = allDoctors.length + allPharmacies.length;

  return (
    <Shell role="admin">
      <div className="max-w-6xl space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              License & Credential Verification Registry
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Comprehensive overview of all clinical practitioners, dispensary drug licenses, and regulatory approvals.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/audit">View Audit Ledger →</Link>
            </Button>
            <Button size="sm" loading={loading} onClick={() => loadData(statusFilter)}>
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-medium text-[var(--success)] border border-[var(--success)]/20">
            {successMsg}
          </div>
        )}

        {/* Filter Controls Bar */}
        <Card className="p-4 space-y-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mr-2">
              Status Filter:
            </span>
            {[
              { id: "all", label: "All Registrations" },
              { id: "pending", label: "Pending" },
              { id: "verified", label: "Verified / Approved" },
              { id: "under_review", label: "Under Review" },
              { id: "rejected", label: "Rejected" },
              { id: "suspended", label: "Suspended" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id as StatusFilter)}
                className={`px-3 py-1.5 rounded-[var(--r-md)] text-xs font-semibold transition-all ${
                  statusFilter === s.id
                    ? "bg-[var(--accent)] text-white shadow-2xs"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Search & Category Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, clinic, city, or license number..."
              className="w-full sm:w-80 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-1.5 text-xs text-[var(--text)] focus-visible-ring"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  activeTab === "all"
                    ? "bg-[var(--bg-subtle)] font-bold text-[var(--text)] border border-[var(--border)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                All ({filteredDoctors.length + filteredPharmacies.length})
              </button>
              <button
                onClick={() => setActiveTab("doctors")}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  activeTab === "doctors"
                    ? "bg-[var(--bg-subtle)] font-bold text-[var(--text)] border border-[var(--border)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                Doctors ({filteredDoctors.length})
              </button>
              <button
                onClick={() => setActiveTab("pharmacies")}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  activeTab === "pharmacies"
                    ? "bg-[var(--bg-subtle)] font-bold text-[var(--text)] border border-[var(--border)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                Pharmacies ({filteredPharmacies.length})
              </button>
            </div>
          </div>
        </Card>

        {/* Loading Skeletons */}
        {data === null && !error && (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-[var(--r-xl)]" />
            <Skeleton className="h-40 rounded-[var(--r-xl)]" />
          </div>
        )}

        {/* Empty state */}
        {data && filteredDoctors.length === 0 && filteredPharmacies.length === 0 && (
          <Card className="p-12 text-center space-y-2">
            <h3 className="text-sm font-bold text-[var(--text)]">No Registrations Found</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              No doctor or pharmacy profiles match the filter “{statusFilter}” {searchQuery ? `and query “${searchQuery}”` : ""}.
            </p>
          </Card>
        )}

        {/* Doctors Section */}
        {(activeTab === "all" || activeTab === "doctors") && filteredDoctors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Medical Practitioners & Doctors ({filteredDoctors.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredDoctors.map((doc) => {
                const isVerified = doc.verification_status === "verified";
                const isBusy = busyId === `doctor-${doc.id}`;

                return (
                  <Card key={doc.id} className="p-5 space-y-4 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-base text-[var(--text)]">
                            Dr. {doc.name || "Doctor"}
                          </span>
                          {getStatusBadge(doc.verification_status)}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {doc.email} {doc.phone && `· Phone: ${doc.phone}`}
                        </p>
                      </div>

                      {doc.created_at && (
                        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                          Registered: {new Date(doc.created_at).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>

                    {/* Detailed info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          State Medical Registration
                        </span>
                        <p className="font-mono font-semibold text-[var(--text)] mt-0.5">
                          {doc.registration_number || "Not provided"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Qualification / Degree
                        </span>
                        <p className="font-medium text-[var(--text)] mt-0.5">
                          {doc.qualification || "Not provided"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Clinic / Hospital Practice
                        </span>
                        <p className="font-medium text-[var(--text)] mt-0.5">
                          {doc.clinic_name || "Not provided"}
                        </p>
                      </div>
                    </div>

                    {doc.verification_note && (
                      <div className="rounded-[var(--r-md)] bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--text-secondary)] border border-[var(--border)]">
                        <span className="font-semibold text-[var(--text)]">Admin Review Note: </span>
                        {doc.verification_note}
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] mr-2">
                        Set Decision:
                      </span>

                      {!isVerified && (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          loading={isBusy}
                          onClick={() => executeDecision("doctor", doc.id, "approve")}
                        >
                          ✓ Approve License
                        </Button>
                      )}

                      {doc.verification_status !== "under_review" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("doctor", doc.id, doc.name || `Doctor #${doc.id}`, "review")}
                        >
                          Mark Under Review
                        </Button>
                      )}

                      {doc.verification_status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("doctor", doc.id, doc.name || `Doctor #${doc.id}`, "reject")}
                        >
                          Reject License
                        </Button>
                      )}

                      {isVerified && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("doctor", doc.id, doc.name || `Doctor #${doc.id}`, "suspend")}
                        >
                          Suspend Practitioner
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Pharmacies Section */}
        {(activeTab === "all" || activeTab === "pharmacies") && filteredPharmacies.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Retail Dispensary Pharmacies ({filteredPharmacies.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredPharmacies.map((pharm) => {
                const licNo = pharm.license_number || pharm.licence_number || "Pending";
                const isVerified = pharm.verification_status === "verified";
                const isBusy = busyId === `pharmacy-${pharm.id}`;

                return (
                  <Card key={pharm.id} className="p-5 space-y-4 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-base text-[var(--text)]">
                            {pharm.pharmacy_name || pharm.name}
                          </span>
                          {getStatusBadge(pharm.verification_status)}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {pharm.email} {pharm.phone && `· Phone: ${pharm.phone}`} {pharm.contact_person && `· Contact: ${pharm.contact_person}`}
                        </p>
                      </div>

                      {pharm.created_at && (
                        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                          Registered: {new Date(pharm.created_at).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>

                    {/* Detailed info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Drug License Number
                        </span>
                        <p className="font-mono font-semibold text-[var(--text)] mt-0.5">
                          {licNo}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Location Address
                        </span>
                        <p className="font-medium text-[var(--text)] mt-0.5">
                          {pharm.address ? `${pharm.address}, ${pharm.city} - ${pharm.pin_code}` : pharm.city || "Not set"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Operating Hours
                        </span>
                        <p className="font-medium text-[var(--text)] mt-0.5">
                          {pharm.opening_hours || "Standard dispensary hours"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                          Pickup Fee & Validity
                        </span>
                        <p className="font-medium text-[var(--text)] mt-0.5">
                          ₹{pharm.default_pickup_fee || "0"} · {pharm.default_validity_days || 3} days
                        </p>
                      </div>
                    </div>

                    {pharm.verification_note && (
                      <div className="rounded-[var(--r-md)] bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--text-secondary)] border border-[var(--border)]">
                        <span className="font-semibold text-[var(--text)]">Admin Review Note: </span>
                        {pharm.verification_note}
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] mr-2">
                        Set Decision:
                      </span>

                      {!isVerified && (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          loading={isBusy}
                          onClick={() => executeDecision("pharmacy", pharm.id, "approve")}
                        >
                          ✓ Approve Drug License
                        </Button>
                      )}

                      {pharm.verification_status !== "under_review" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("pharmacy", pharm.id, pharm.pharmacy_name || `Pharmacy #${pharm.id}`, "review")}
                        >
                          Mark Under Review
                        </Button>
                      )}

                      {pharm.verification_status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("pharmacy", pharm.id, pharm.pharmacy_name || `Pharmacy #${pharm.id}`, "reject")}
                        >
                          Reject License
                        </Button>
                      )}

                      {isVerified && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isBusy}
                          onClick={() => openActionWithNote("pharmacy", pharm.id, pharm.pharmacy_name || `Pharmacy #${pharm.id}`, "suspend")}
                        >
                          Suspend Store
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Note Dialog Modal */}
        {noteModalOpen && targetItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Confirm Administrative Decision
                </span>
                <h3 className="text-base font-bold text-[var(--text)]">
                  {targetItem.decision.toUpperCase()} {targetItem.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Please provide a reason or administrative note for this decision.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                  Verification Note / Reason
                </label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. License renewal certificate pending; or Suspended due to invalid registration"
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setNoteModalOpen(false);
                    setTargetItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  variant={targetItem.decision === "suspend" ? "danger" : "primary"}
                  loading={busyId === `${targetItem.type}-${targetItem.id}`}
                  onClick={() => executeDecision(targetItem.type, targetItem.id, targetItem.decision, noteText)}
                >
                  Confirm {targetItem.decision.toUpperCase()}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
