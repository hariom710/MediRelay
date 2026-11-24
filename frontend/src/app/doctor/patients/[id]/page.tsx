"use client";

import Link from "next/link";
import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import {
  type Patient,
  type Prescription,
  type ClinicalSummary,
  type PatientTimelineEvent,
  type ClinicalVisit,
} from "@/lib/types";

type ActiveTab = "summary" | "timeline" | "prescriptions" | "visits";

function PatientDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const patientId = Number(id);

  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineEvent[] | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [visits, setVisits] = useState<ClinicalVisit[] | null>(null);

  const [error, setError] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineScopeRestricted, setTimelineScopeRestricted] = useState(false);

  // New visit form state
  const [newVisitModal, setNewVisitModal] = useState(false);
  const [visitComplaint, setVisitComplaint] = useState("");
  const [visitDiagnosis, setVisitDiagnosis] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitError, setVisitError] = useState("");

  useEffect(() => {
    if (!id) return;

    // Load Patient details
    api<Patient>(`/patients/${id}`)
      .then((p) => {
        setPatient(p);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load patient.");
      });

    // Load Clinical Summary
    setLoadingSummary(true);
    api<ClinicalSummary>(`/patients/${id}/summary`)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoadingSummary(false));

    // Load Prescriptions
    api<Prescription[]>("/prescriptions")
      .then((rxList) => setPrescriptions(rxList.filter((p) => p.patient === patientId)))
      .catch(() => {});

    // Load Visits
    api<ClinicalVisit[]>(`/patients/${id}/visits`)
      .then(setVisits)
      .catch(() => {});
  }, [id, patientId]);

  // Lazy load timeline on tab switch
  useEffect(() => {
    if (activeTab === "timeline" && timeline === null && !loadingTimeline && !timelineScopeRestricted) {
      setLoadingTimeline(true);
      api<PatientTimelineEvent[]>(`/patients/${id}/timeline`)
        .then((events) => {
          setTimeline(events);
          setTimelineScopeRestricted(false);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) {
            setTimelineScopeRestricted(true);
          } else {
            setError(err instanceof Error ? err.message : "Could not load timeline.");
          }
        })
        .finally(() => setLoadingTimeline(false));
    }
  }, [activeTab, id, timeline, loadingTimeline, timelineScopeRestricted]);

  async function handleCreateVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!visitComplaint.trim() || !visitDiagnosis.trim()) {
      setVisitError("Chief complaint and diagnosis are required.");
      return;
    }

    setSavingVisit(true);
    setVisitError("");
    try {
      const created = await api<ClinicalVisit>(`/patients/${id}/visits`, {
        method: "POST",
        body: {
          chief_complaint: visitComplaint.trim(),
          diagnosis: visitDiagnosis.trim(),
          private_notes: visitNotes.trim(),
        },
      });
      setVisits((prev) => (prev ? [created, ...prev] : [created]));
      setNewVisitModal(false);
      setVisitComplaint("");
      setVisitDiagnosis("");
      setVisitNotes("");
      // Refresh summary & timeline
      api<ClinicalSummary>(`/patients/${id}/summary`).then(setSummary).catch(() => {});
      api<PatientTimelineEvent[]>(`/patients/${id}/timeline`).then(setTimeline).catch(() => {});
    } catch (err: unknown) {
      setVisitError(err instanceof Error ? err.message : "Failed to record clinical visit.");
    } finally {
      setSavingVisit(false);
    }
  }

  const scope = patient?.active_access?.scope || "full";

  return (
    <Shell role="doctor">
      <div className="max-w-5xl space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
                {patient?.name || "Patient Record"}
              </h1>
              {patient?.patient_code && (
                <Badge variant="neutral" size="sm">
                  {patient.patient_code}
                </Badge>
              )}
              <Badge variant={scope === "full" ? "success" : "neutral"} size="sm">
                {scope.toUpperCase()} ACCESS
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span>{patient?.email}</span>
              {patient?.date_of_birth && <span>DOB: {patient.date_of_birth}</span>}
              {patient?.gender && <span>Gender: {patient.gender}</span>}
              {patient?.blood_group && <span>Blood Group: {patient.blood_group}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setVisitError("");
                setNewVisitModal(true);
              }}
            >
              + Record Visit
            </Button>
            <Button size="sm" asChild>
              <Link href={`/doctor/prescriptions/new?patient=${id}`}>
                New Prescription →
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-[var(--border)]">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab("summary")}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "summary"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              Clinical Summary
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "timeline"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              Cross-Doctor Timeline
            </button>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "prescriptions"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              Prescriptions ({prescriptions?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("visits")}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "visits"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              Visits & Private Notes ({visits?.length ?? 0})
            </button>
          </nav>
        </div>

        {/* Tab 1: Clinical Summary */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">
                  Known Drug & Food Allergies
                </span>
                {summary?.allergies ? (
                  <div className="rounded-[var(--r-md)] border border-red-500/20 bg-red-50/70 p-3 text-xs font-semibold text-red-900 dark:bg-red-950/20 dark:text-red-200">
                    ⚠️ {summary.allergies}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">No known allergies recorded.</p>
                )}
              </Card>

              <Card className="p-5 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">
                  Chronic Conditions
                </span>
                {summary?.chronic_conditions ? (
                  <div className="rounded-[var(--r-md)] border border-amber-500/20 bg-amber-50/70 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                    🩺 {summary.chronic_conditions}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">No chronic conditions listed.</p>
                )}
              </Card>
            </div>

            {/* Active Medications */}
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text)]">
                Active Medications
              </div>
              {loadingSummary ? (
                <div className="p-6 text-xs text-[var(--text-tertiary)]">Loading active medications…</div>
              ) : summary?.active_medications?.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                  No currently active medications on file.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {summary?.active_medications.map((m, idx) => (
                    <li key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--text)]">{m.medicine_name}</span>
                          <Badge variant="neutral" size="sm">{m.strength} {m.dosage_form}</Badge>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{m.instructions}</p>
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)] sm:text-right">
                        <span>Prescribed by {m.prescribed_by}</span>
                        {m.valid_until && <span className="block text-[11px]">Valid until: {m.valid_until}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: Cross-Doctor Timeline */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {timelineScopeRestricted ? (
              <Card className="p-8 text-center space-y-3">
                <Badge variant="warning">BASIC ACCESS LIMITED</Badge>
                <h3 className="text-sm font-bold text-[var(--text)]">Full Clinical History Restricted</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  The patient has granted you Basic Scope access (demographics, allergies, and active medications only). Cross-doctor consultation history, past prescriptions, and pharmacy purchases require Full Scope consent.
                </p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await api("/access/requests", {
                          method: "POST",
                          body: { patient_id: patientId, scope: "full" },
                        });
                        alert("Full access request sent to patient.");
                      } catch {
                        alert("Could not request full access.");
                      }
                    }}
                  >
                    Request Full Scope Access
                  </Button>
                </div>
              </Card>
            ) : loadingTimeline ? (
              <div className="p-12 text-center text-xs text-[var(--text-tertiary)]">
                Aggregating cross-doctor timeline…
              </div>
            ) : timeline?.length === 0 ? (
              <Card className="p-8 text-center text-xs text-[var(--text-secondary)]">
                No past consultations or orders found in timeline.
              </Card>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                {timeline?.map((event, idx) => (
                  <div key={idx} className="relative group">
                    {/* Circle marker */}
                    <div
                      className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-elevated)] ${
                        event.type === "visit"
                          ? "bg-blue-500"
                          : event.type === "prescription"
                          ? "bg-emerald-500"
                          : "bg-purple-500"
                      }`}
                    />

                    <Card className="p-4 space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              event.type === "visit"
                                ? "default"
                                : event.type === "prescription"
                                ? "success"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {event.type.toUpperCase()}
                          </Badge>
                          <span className="font-bold text-xs text-[var(--text)]">{event.title}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                          {event.date}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {event.description}
                      </p>

                      <div className="text-[11px] text-[var(--text-tertiary)] pt-1 flex items-center gap-4">
                        {event.doctor_name && <span>Doctor: {event.doctor_name}</span>}
                        {event.pharmacy_name && <span>Pharmacy: {event.pharmacy_name}</span>}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Prescriptions */}
        {activeTab === "prescriptions" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-[var(--text)]">Prescription History</h3>
              <Button size="sm" asChild>
                <Link href={`/doctor/prescriptions/new?patient=${id}`}>+ New Prescription</Link>
              </Button>
            </div>

            {prescriptions === null ? (
              <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">Loading prescriptions…</div>
            ) : prescriptions.length === 0 ? (
              <Card className="p-8 text-center text-xs text-[var(--text-secondary)]">
                No prescriptions on file for this patient.
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-[var(--border)]">
                  {prescriptions.map((rx) => (
                    <li key={rx.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-subtle)]/40 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--text)]">RX-{rx.id}</span>
                          <Badge variant="neutral" size="sm">v{rx.version}</Badge>
                          <Badge
                            variant={rx.status === "finalized" ? "success" : rx.status === "cancelled" ? "danger" : "neutral"}
                            size="sm"
                          >
                            {rx.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Consultation: {rx.consultation_date} · {rx.items?.length ?? 0} item(s)
                        </p>
                      </div>

                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/doctor/prescriptions/${rx.id}`}>View Prescription →</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* Tab 4: Visits & Author-Only Notes */}
        {activeTab === "visits" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Consultation Visits</h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Clinical encounters recorded by doctors. Private notes are visible only to the authoring doctor.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setVisitError("");
                  setNewVisitModal(true);
                }}
              >
                + Record Visit
              </Button>
            </div>

            {visits === null ? (
              <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">Loading visits…</div>
            ) : visits.length === 0 ? (
              <Card className="p-8 text-center text-xs text-[var(--text-secondary)]">
                No consultation visits recorded yet.
              </Card>
            ) : (
              <div className="space-y-3">
                {visits.map((v) => (
                  <Card key={v.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border)] pb-2.5">
                      <div>
                        <span className="font-bold text-xs text-[var(--text)]">Consultation with {v.doctor_name}</span>
                        <span className="ml-2 text-[11px] text-[var(--text-tertiary)] font-mono">{v.visit_date}</span>
                      </div>
                      {v.prescription_id && (
                        <Badge variant="neutral" size="sm">
                          Linked to RX-{v.prescription_id}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Chief Complaint</span>
                        <p className="text-[var(--text)] mt-0.5">{v.chief_complaint}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Diagnosis</span>
                        <p className="text-[var(--text)] mt-0.5">{v.diagnosis}</p>
                      </div>
                    </div>

                    {v.private_notes && (
                      <div className="rounded-[var(--r-md)] border border-amber-500/20 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-1">
                          🔒 Author Private Clinical Notes (Confidential)
                        </span>
                        <p className="text-amber-950 dark:text-amber-100">{v.private_notes}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Record Visit Modal */}
        {newVisitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text)]">Record Clinical Visit</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Log symptoms, diagnosis, and private confidential notes.
                </p>
              </div>

              {visitError && (
                <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-3 text-xs text-[var(--danger)] border border-[var(--danger)]/20">
                  {visitError}
                </div>
              )}

              <form onSubmit={handleCreateVisit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Chief Complaint <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={visitComplaint}
                    onChange={(e) => setVisitComplaint(e.target.value)}
                    placeholder="e.g. Fever with chills for 3 days"
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Clinical Diagnosis <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={visitDiagnosis}
                    onChange={(e) => setVisitDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Viral Bronchitis"
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                    Private Notes (Confidential to you)
                  </label>
                  <textarea
                    rows={3}
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="Sensitive observations, differential thoughts, author-only..."
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] focus-visible-ring"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    These notes will never be shown to other doctors or pharmacies.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setNewVisitModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={savingVisit}
                    loading={savingVisit}
                  >
                    Save Clinical Visit
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

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading patient…</div>}>
      <PatientDetailInner params={params} />
    </Suspense>
  );
}
