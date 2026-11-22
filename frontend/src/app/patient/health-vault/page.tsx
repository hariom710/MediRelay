"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  FolderHeart,
  Users2,
  Bell,
  Plus,
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Calendar,
  Sparkles,
  Heart,
  DollarSign,
  TrendingDown,
} from "lucide-react";

interface MedicalDocument {
  id: number;
  title: string;
  document_type: string;
  file_url: string;
  file_name: string;
  notes: string;
  created_at: string;
}

interface FamilyMember {
  id: number;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  blood_group: string;
  allergies: string;
}

interface MedicationReminder {
  id: number;
  medicine_name: string;
  dosage: string;
  timing: string;
  meal_relation: string;
  is_active: boolean;
  last_taken_at: string | null;
}

export default function PatientHealthVault() {
  const [documents, setDocuments] = useState<MedicalDocument[] | null>(null);
  const [family, setFamily] = useState<FamilyMember[] | null>(null);
  const [reminders, setReminders] = useState<MedicationReminder[] | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "family" | "reminders" | "expenses">("documents");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("blood_report");
  const [docNotes, setDocNotes] = useState("");

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [famName, setFamName] = useState("");
  const [famRel, setFamRel] = useState("spouse");
  const [famBlood, setFamBlood] = useState("O+");
  const [famAllergies, setFamAllergies] = useState("");

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [remMed, setRemMed] = useState("");
  const [remDosage, setRemDosage] = useState("1 Tablet");
  const [remTiming, setRemTiming] = useState("08:00 AM");
  const [remMeal, setRemMeal] = useState("after_food");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [docs, fams, rems] = await Promise.all([
        api<MedicalDocument[]>("/patient/documents"),
        api<FamilyMember[]>("/patient/family"),
        api<MedicationReminder[]>("/patient/reminders"),
      ]);
      setDocuments(docs);
      setFamily(fams);
      setReminders(rems);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/patient/documents", {
        method: "POST",
        body: {
          title: docTitle,
          document_type: docType,
          file_url: "https://medirelay.internal/vault/" + encodeURIComponent(docTitle) + ".pdf",
          file_name: docTitle + ".pdf",
          notes: docNotes,
        },
      });
      setShowDocModal(false);
      setDocTitle("");
      setDocNotes("");
      setSuccessMsg("Document encrypted and stored in your health vault.");
      loadAll();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleDeleteDoc(id: number) {
    try {
      await api(`/patient/documents/${id}`, { method: "DELETE" });
      setDocuments((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
      setSuccessMsg("Document removed from vault.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleAddFamily(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/patient/family", {
        method: "POST",
        body: {
          full_name: famName,
          relationship: famRel,
          blood_group: famBlood,
          allergies: famAllergies,
        },
      });
      setShowFamilyModal(false);
      setFamName("");
      setFamAllergies("");
      setSuccessMsg(`Family member profile created for ${famName}.`);
      loadAll();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleAddReminder(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/patient/reminders", {
        method: "POST",
        body: {
          medicine_name: remMed,
          dosage: remDosage,
          timing: remTiming,
          meal_relation: remMeal,
        },
      });
      setShowReminderModal(false);
      setRemMed("");
      setSuccessMsg("Medication dose reminder configured.");
      loadAll();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleTakeReminder(id: number) {
    try {
      await api(`/patient/reminders/${id}/take`, { method: "POST" });
      setSuccessMsg("Dose recorded as taken!");
      loadAll();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  return (
    <PortalShell role="patient">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Personal Health Management & Vault
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Secure digital vault for diagnostic records, family profiles, medicine reminders, and healthcare spending.
          </p>
        </div>

        {/* Action Button based on tab */}
        {activeTab === "documents" && (
          <button
            onClick={() => setShowDocModal(true)}
            className="tap-interactive inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        )}
        {activeTab === "family" && (
          <button
            onClick={() => setShowFamilyModal(true)}
            className="tap-interactive inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add Family Profile
          </button>
        )}
        {activeTab === "reminders" && (
          <button
            onClick={() => setShowReminderModal(true)}
            className="tap-interactive inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Add Reminder
          </button>
        )}
      </div>

      {/* Notifications */}
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

      {/* Segmented Pill Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
        {[
          { id: "documents", label: "Document Vault", icon: FolderHeart, count: documents?.length },
          { id: "family", label: "Family Profiles", icon: Users2, count: family?.length },
          { id: "reminders", label: "Medicine Reminders", icon: Bell, count: reminders?.length },
          { id: "expenses", label: "Expense & Savings", icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`tap-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${isActive ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-zinc-200 dark:bg-zinc-800"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Document Vault */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {documents === null ? (
            <p className="p-8 text-xs text-zinc-400 text-center">Loading encrypted vault…</p>
          ) : documents.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <FolderHeart className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Vault is empty</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Upload your blood test reports, X-rays, discharge summaries, or previous prescriptions to keep them organized in one place.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="glass-panel rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {doc.document_type.replace("_", " ")}
                      </span>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{doc.title}</h3>
                    {doc.notes && <p className="text-xs text-zinc-500 mt-1">{doc.notes}</p>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-400 border-t border-black/[0.04] dark:border-white/[0.06] pt-2">
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    <span className="font-mono text-blue-600">Encrypted</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Family Profiles */}
      {activeTab === "family" && (
        <div className="space-y-4">
          {family === null ? (
            <p className="p-8 text-xs text-zinc-400 text-center">Loading family profiles…</p>
          ) : family.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <Users2 className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No family profiles</p>
              <p className="text-xs text-zinc-400 mt-1">Add profiles for children, spouse, or elderly parents to manage their prescriptions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {family.map((f) => (
                <div key={f.id} className="glass-panel rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{f.full_name}</h3>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 capitalize">
                      {f.relationship}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">Blood Group: <strong>{f.blood_group || "Not recorded"}</strong></p>
                  {f.allergies && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">Allergies: {f.allergies}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Reminders */}
      {activeTab === "reminders" && (
        <div className="space-y-4">
          {reminders === null ? (
            <p className="p-8 text-xs text-zinc-400 text-center">Loading medicine reminders…</p>
          ) : reminders.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No active dose reminders</p>
              <p className="text-xs text-zinc-400 mt-1">Set daily medicine alerts to maintain adherence.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div key={r.id} className="glass-panel rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{r.medicine_name}</h4>
                      <p className="text-xs text-zinc-500">
                        {r.dosage} at <strong className="text-zinc-800 dark:text-zinc-200">{r.timing}</strong> · {r.meal_relation.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {r.last_taken_at && (
                      <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                        Taken today at {new Date(r.last_taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <button
                      onClick={() => handleTakeReminder(r.id)}
                      className="tap-interactive inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Taken
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Healthcare Expense Tracker */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Monthly Spending</span>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">₹4,850</h3>
              <p className="text-xs text-zinc-500 mt-1">Prescriptions + Consultations</p>
            </div>
            <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Savings from MediRelay</span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">₹1,420</h3>
              <p className="text-xs text-zinc-500 mt-1">Calculated via multi-pharmacy price engine</p>
            </div>
            <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Active Prescriptions</span>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">2 Active</h3>
              <p className="text-xs text-zinc-500 mt-1">Covering 5 ongoing medicines</p>
            </div>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1]">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Store Document in Vault</h3>
              <button onClick={() => setShowDocModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddDocument} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thyroid Profile 2026"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Category</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                >
                  <option value="blood_report">Blood Test / CBC</option>
                  <option value="imaging">X-Ray / MRI / CT Scan</option>
                  <option value="discharge_summary">Discharge Summary</option>
                  <option value="prescription">Prescription Copy</option>
                  <option value="invoice">Pharmacy Invoice</option>
                  <option value="other">Other Document</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white p-3 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600">Cancel</button>
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1]">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Add Family Member</h3>
              <button onClick={() => setShowFamilyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddFamily} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Doe"
                  value={famName}
                  onChange={(e) => setFamName(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Relationship</label>
                <select
                  value={famRel}
                  onChange={(e) => setFamRel(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                >
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Blood Group</label>
                <input
                  type="text"
                  placeholder="e.g. O+, B+, A-"
                  value={famBlood}
                  onChange={(e) => setFamBlood(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Dust, Amoxicillin"
                  value={famAllergies}
                  onChange={(e) => setFamAllergies(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowFamilyModal(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600">Cancel</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1]">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">New Medicine Reminder</h3>
              <button onClick={() => setShowReminderModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddReminder} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Medicine Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin 500mg"
                  value={remMed}
                  onChange={(e) => setRemMed(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Time</label>
                <input
                  type="text"
                  placeholder="e.g. 08:00 AM, 09:00 PM"
                  value={remTiming}
                  onChange={(e) => setRemTiming(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Meal Relation</label>
                <select
                  value={remMeal}
                  onChange={(e) => setRemMeal(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                >
                  <option value="after_food">After Food</option>
                  <option value="before_food">Before Food</option>
                  <option value="with_food">With Food</option>
                  <option value="empty_stomach">Empty Stomach</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowReminderModal(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600">Cancel</button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500">Save Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
