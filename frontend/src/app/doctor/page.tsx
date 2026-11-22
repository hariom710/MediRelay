"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  Users,
  Plus,
  Search,
  FileText,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Trash2,
  Share2,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";

interface Patient {
  id: number;
  name: string;
  email: string;
  allergies: string;
}

interface Medicine {
  id: number;
  name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  pack_size: number;
}

interface PrescriptionItemInput {
  medicine: number;
  medicineName?: string;
  morning: number;
  afternoon: number;
  night: number;
  meal_timing: string;
  duration_days: number;
  instructions: string;
}

interface Prescription {
  id: number;
  patient_id: number;
  patient_name?: string;
  status: string;
  version: number;
  consultation_date: string;
  notes: string;
  items: {
    id: number;
    medicine_name: string;
    dosage_form: string;
    strength: string;
    total_qty: number;
    instructions: string;
  }[];
}

interface ShareResponse {
  token: string;
  share_id: number;
  expires_at: string;
  scoped_view: unknown;
}

export default function DoctorPortal() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Prescription creation modal/studio state
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | "">("");
  const [consultDate, setConsultDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PrescriptionItemInput[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingMed, setIsSearchingMed] = useState(false);

  // New patient registration state
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newPatientAllergies, setNewPatientAllergies] = useState("");

  // Share link state
  const [shareInfo, setShareInfo] = useState<{
    rxId: number;
    token: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    setConsultDate(new Date().toISOString().slice(0, 10));
    loadData();
  }, []);

  async function loadData() {
    try {
      const [pts, rxs] = await Promise.all([
        api<Patient[]>("/patients"),
        api<Prescription[]>("/prescriptions"),
      ]);
      setPatients(pts);
      setPrescriptions(rxs);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  async function handleSearchMedicine(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setMedicines([]);
      return;
    }
    setIsSearchingMed(true);
    try {
      const res = await api<Medicine[]>(`/medicines/search?q=${encodeURIComponent(q)}`);
      setMedicines(res);
    } catch {
      // ignore
    } finally {
      setIsSearchingMed(false);
    }
  }

  function addItem(med: Medicine) {
    setItems((prev) => [
      ...prev,
      {
        medicine: med.id,
        medicineName: `${med.name} (${med.strength})`,
        morning: 1,
        afternoon: 0,
        night: 1,
        meal_timing: "after_meal",
        duration_days: 5,
        instructions: "Take as directed",
      },
    ]);
    setSearchQuery("");
    setMedicines([]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<PrescriptionItemInput>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  async function handleCreatePrescription(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) {
      setError("Please select a patient.");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one medicine item.");
      return;
    }

    setError("");
    try {
      await api("/prescriptions", {
        method: "POST",
        body: {
          patient_id: selectedPatientId,
          consultation_date: consultDate,
          notes,
          items: items.map((i) => ({
            medicine: i.medicine,
            morning: i.morning,
            afternoon: i.afternoon,
            night: i.night,
            meal_timing: i.meal_timing,
            duration_days: i.duration_days,
            instructions: i.instructions,
          })),
        },
      });

      setSuccessMsg("Prescription draft created successfully.");
      setIsCreating(false);
      setItems([]);
      setNotes("");
      loadData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to create prescription.");
    }
  }

  async function handleFinalize(rxId: number) {
    setError("");
    try {
      await api(`/prescriptions/${rxId}/finalize`, { method: "POST" });
      setSuccessMsg(`Prescription RX-${rxId} has been signed and finalized.`);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleCreateShare(rxId: number) {
    setError("");
    try {
      const res = await api<ShareResponse>(`/prescriptions/${rxId}/shares`, {
        method: "POST",
        body: { valid_days: 7 },
      });
      setShareInfo({
        rxId,
        token: res.token,
        expiresAt: res.expires_at,
      });
      setSuccessMsg(`Secure share link generated for RX-${rxId}.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const newPt = await api<Patient>("/patients", {
        method: "POST",
        body: {
          name: newPatientName,
          email: newPatientEmail,
          allergies: newPatientAllergies,
        },
      });
      setPatients((prev) => (prev ? [...prev, newPt] : [newPt]));
      setSelectedPatientId(newPt.id);
      setIsAddingPatient(false);
      setNewPatientName("");
      setNewPatientEmail("");
      setNewPatientAllergies("");
      setSuccessMsg(`Patient ${newPt.name} added successfully.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId);

  return (
    <PortalShell role="doctor">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Clinical Prescription Studio
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Create tamper-evident prescriptions, manage dosage schedules, and generate secure pharmacy links.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingPatient(true)}
            className="tap-interactive inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-white/[0.1] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Users className="h-4 w-4 text-zinc-400" />
            Add Patient
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="tap-interactive inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Prescription
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-900/40">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
        </div>
      )}

      {/* Share Link Banner if active */}
      {shareInfo && (
        <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
              <Share2 className="h-4 w-4 text-blue-600" />
              <span>Prescription RX-{shareInfo.rxId} Shared</span>
            </div>
            <button onClick={() => setShareInfo(null)} className="text-xs text-blue-600 hover:underline">Close</button>
          </div>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            Share Token (give to patient or pharmacy):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareInfo.token}
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs text-blue-900 dark:border-blue-800 dark:bg-zinc-950 dark:text-blue-200"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareInfo.token);
                setSuccessMsg("Share token copied to clipboard!");
              }}
              className="tap-interactive shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-500"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Expires: {new Date(shareInfo.expiresAt).toLocaleString()}</p>
        </div>
      )}

      {/* Main Grid: Prescriptions & Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Prescriptions List (Col 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Prescription History
            </h2>
            <span className="text-xs text-zinc-400 font-medium">{prescriptions?.length ?? 0} prescriptions</span>
          </div>

          {prescriptions === null ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-xs text-zinc-400">Loading prescriptions…</div>
          ) : prescriptions.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-zinc-300 mb-3" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No prescriptions recorded</p>
              <p className="mt-1 text-xs text-zinc-400">Click &ldquo;New Prescription&rdquo; above to write your first prescription.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx) => {
                const isFinalized = rx.status === "finalized";
                return (
                  <div
                    key={rx.id}
                    className="glass-panel rounded-2xl p-5 hover:shadow-md transition-all border border-black/[0.06] dark:border-white/[0.08]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                            RX-{rx.id}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">v{rx.version}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              isFinalized
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            }`}
                          >
                            {rx.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Date: {rx.consultation_date} {rx.notes && `· Notes: ${rx.notes}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isFinalized && (
                          <button
                            onClick={() => handleFinalize(rx.id)}
                            className="tap-interactive rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-700 dark:bg-white dark:text-black"
                          >
                            Sign & Finalize
                          </button>
                        )}
                        {isFinalized && (
                          <button
                            onClick={() => handleCreateShare(rx.id)}
                            className="tap-interactive inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                          >
                            <Share2 className="h-3 w-3" />
                            Share
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Prescribed Items Sub-list */}
                    {rx.items && rx.items.length > 0 && (
                      <div className="mt-4 border-t border-black/[0.04] dark:border-white/[0.06] pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Prescribed Medicines</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rx.items.map((it) => (
                            <div key={it.id} className="rounded-xl bg-zinc-50/80 p-2.5 text-xs dark:bg-zinc-900/60 flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{it.medicine_name}</span>
                                <span className="block text-[11px] text-zinc-400">{it.strength} · {it.instructions}</span>
                              </div>
                              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{it.total_qty} units</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Patients Sidebar (Col 1/3) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Patient Records
            </h2>
            <span className="text-xs text-zinc-400 font-medium">{patients?.length ?? 0}</span>
          </div>

          <div className="glass-panel rounded-2xl divide-y divide-black/[0.04] dark:divide-white/[0.06] overflow-hidden">
            {patients === null ? (
              <p className="p-5 text-xs text-zinc-400 text-center">Loading patients…</p>
            ) : patients.length === 0 ? (
              <p className="p-5 text-xs text-zinc-400 text-center">No patients found. Add one above.</p>
            ) : (
              patients.map((p) => (
                <div key={p.id} className="p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">{p.name}</p>
                      <p className="text-[11px] text-zinc-400">{p.email}</p>
                    </div>
                    {p.allergies && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {p.allergies}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setIsCreating(true);
                    }}
                    className="mt-2.5 text-[11px] font-semibold text-blue-600 hover:text-blue-500 inline-flex items-center gap-1"
                  >
                    Write Rx <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Prescription Studio Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1] my-8">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Prescription Studio
                </h3>
                <p className="text-xs text-zinc-400">Configure medicines, dosage schedule, and patient allergy checks</p>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-zinc-400 hover:text-zinc-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePrescription} className="mt-6 space-y-6">
              {/* Patient Selection & Consultation Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Select Patient
                  </label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value) || "")}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">-- Choose patient --</option>
                    {patients?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Consultation Date
                  </label>
                  <input
                    type="date"
                    required
                    value={consultDate}
                    onChange={(e) => setConsultDate(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Allergy Warning if Patient has allergies */}
              {selectedPatient?.allergies && (
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span><strong>Known Allergies for {selectedPatient.name}:</strong> {selectedPatient.allergies}</span>
                </div>
              )}

              {/* Medicine Catalogue Search */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Search & Add Medicines (Catalogue)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by brand name or generic (e.g. Paracetamol, Amoxicillin)…"
                    value={searchQuery}
                    onChange={(e) => handleSearchMedicine(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 pl-9 text-xs text-zinc-800 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                  />
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                </div>

                {/* Autocomplete dropdown */}
                {medicines.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-1 shadow-lg dark:border-white/[0.1] dark:bg-zinc-900">
                    {medicines.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => addItem(m)}
                        className="flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-white">{m.name}</span>
                          <span className="text-[11px] text-zinc-400 ml-2">({m.generic_name})</span>
                        </div>
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {m.dosage_form} · {m.strength}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List with Dosage Schedule Builder */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  Prescription Schedule ({items.length} items)
                </h4>
                {items.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No medicines added yet. Use the search bar above.</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-black/[0.06] bg-zinc-50/80 p-4 dark:border-white/[0.08] dark:bg-zinc-900/50"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white">
                            {it.medicineName}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Timing Schedule: Morning / Afternoon / Night */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                          <div>
                            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Morning</label>
                            <input
                              type="number"
                              min={0}
                              value={it.morning}
                              onChange={(e) => updateItem(idx, { morning: Number(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-xs text-center dark:border-white/[0.1] dark:bg-zinc-950"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Afternoon</label>
                            <input
                              type="number"
                              min={0}
                              value={it.afternoon}
                              onChange={(e) => updateItem(idx, { afternoon: Number(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-xs text-center dark:border-white/[0.1] dark:bg-zinc-950"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Night</label>
                            <input
                              type="number"
                              min={0}
                              value={it.night}
                              onChange={(e) => updateItem(idx, { night: Number(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-xs text-center dark:border-white/[0.1] dark:bg-zinc-950"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Duration (days)</label>
                            <input
                              type="number"
                              min={1}
                              value={it.duration_days}
                              onChange={(e) => updateItem(idx, { duration_days: Number(e.target.value) || 1 })}
                              className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-xs text-center dark:border-white/[0.1] dark:bg-zinc-950"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Meal Timing</label>
                            <select
                              value={it.meal_timing}
                              onChange={(e) => updateItem(idx, { meal_timing: e.target.value })}
                              className="w-full rounded-lg border border-black/[0.08] bg-white px-1.5 py-1 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                            >
                              <option value="after_meal">After Food</option>
                              <option value="before_meal">Before Food</option>
                              <option value="with_meal">With Food</option>
                              <option value="empty_stomach">Empty Stomach</option>
                            </select>
                          </div>
                        </div>

                        {/* Calculated total qty indicator */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Instructions: <em>{it.instructions}</em></span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            Total Units: {(it.morning + it.afternoon + it.night) * it.duration_days}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consultation Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Clinical Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional patient advice, diet, or follow-up notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white p-3 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tap-interactive rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500"
                >
                  Save Prescription Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Patient Registration Modal */}
      {isAddingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1]">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Add New Patient</h3>
              <button onClick={() => setIsAddingPatient(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>

            <form onSubmit={handleAddPatient} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={newPatientEmail}
                  onChange={(e) => setNewPatientEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Allergies (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs"
                  value={newPatientAllergies}
                  onChange={(e) => setNewPatientAllergies(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs text-zinc-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingPatient(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tap-interactive rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-500"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
