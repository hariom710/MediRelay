"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { type Patient, type Prescription } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Medicine {
  id: number;
  display_name: string;
  generic_name: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  pack_size: number;
  pack_unit: string;
}

interface RxItem {
  id: number | null;
  medicine: number;
  medicine_name: string;
  strength: string;
  dosage_form: string;
  qty_per_dose: number;
  morning: number;
  afternoon: number;
  night: number;
  meal_timing: string;
  duration_days: number;
  total_qty: number;
  calculated_qty: number;
  instructions: string;
  sort_order: number;
}

const LIQUID_FORMS = new Set(["syrup", "injection", "cream", "drops", "inhaler"]);

function computeQty(item: RxItem): number {
  const doses = (item.morning || 0) + (item.afternoon || 0) + (item.night || 0);
  const qty = doses * (item.qty_per_dose || 1) * (item.duration_days || 1);
  if (LIQUID_FORMS.has(item.dosage_form)) return Math.round(qty * 100) / 100;
  return Math.round(qty);
}

export default function PrescriptionStudio() {
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<RxItem[]>([]);
  const [consultationDate, setConsultationDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);

  const isNewDraft = !draftId;

  // load patient from URL search params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = window.location.search;
    const patientMatch = params.match(/[?&]patient=(\d+)/);
    if (patientMatch) {
      const id = Number(patientMatch[1]);
      setTimeout(() => {
        setPatient({ id, name: `Patient ${id}`, email: "", date_of_birth: null, gender: "", blood_group: "", allergies: "" });
        const v = new Date();
        v.setDate(v.getDate() + 30);
        setValidUntil(v.toISOString().slice(0, 10));
      }, 0);
    }
  }, []);

  // searchMedicines removed - simplified

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {}, 250);
  }

  function addMedicine(med: Medicine) {
    if (items.some((i) => i.medicine === med.id)) return;
    const now = items.length;
    const item: RxItem = {
      id: null,
      medicine: med.id,
      medicine_name: med.display_name,
      strength: med.strength,
      dosage_form: med.dosage_form,
      qty_per_dose: 1,
      morning: 0,
      afternoon: 0,
      night: 0,
      meal_timing: "after_food",
      duration_days: 1,
      total_qty: 0,
      calculated_qty: 0,
      instructions: "",
      sort_order: now,
    };
    setItems([...items, { ...item, total_qty: computeQty(item), calculated_qty: computeQty(item) }]);
    setMedicines([]);
    setSearchQuery("");
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<RxItem>) {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    next[index].total_qty = computeQty(next[index]);
    next[index].calculated_qty = computeQty(next[index]);
    setItems(next);
  }

  // allergy alert
  const allergyAlert =
    patient &&
    patient.allergies &&
    items.some((i) => patient.allergies.toLowerCase().includes(i.medicine_name.toLowerCase()));

  const calculatedTotal = items.reduce((s, i) => s + i.calculated_qty, 0);

  // confirm quantities map
  const [confirmed, setConfirmed] = useState<Record<number, string>>({});

  function handleConfirmQty(itemIndex: number, value: string) {
    setConfirmed({ ...confirmed, [items[itemIndex].id ?? itemIndex]: value });
  }

  async function handleSaveDraft() {
    if (items.length === 0) {
      setError("Add at least one medicine.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        patient_id: patient?.id,
        consultation_date: consultationDate,
        valid_until: validUntil || undefined,
        notes,
        items: items.map((it) => ({
          medicine: it.medicine,
          strength: it.strength,
          dosage_form: it.dosage_form,
          qty_per_dose: it.qty_per_dose,
          morning: it.morning,
          afternoon: it.afternoon,
          night: it.night,
          meal_timing: it.meal_timing,
          duration_days: it.duration_days,
          instructions: it.instructions,
          sort_order: it.sort_order,
        })),
      };
      const method = isNewDraft ? "POST" : "PATCH";
      const url = isNewDraft ? "/prescriptions" : `/prescriptions/${draftId}`;
      const rx = await api<Prescription>(url, { method, body: payload });
      setDraftId(rx.id);
      setItems(
        rx.items.map((it: RxItem) =>
          ({ ...items.find((i) => i.sort_order === it.sort_order)!, id: it.id })
        )
      );
      window.history.replaceState({}, "", `/doctor/prescriptions/new?draft=${rx.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    if (items.length === 0) {
      setError("Add at least one medicine.");
      return;
    }
    // validate confirmed quantities
    for (const it of items) {
      const given = confirmed[it.id ?? it.sort_order];
      if (given === undefined || given === "") {
        setError(`Confirm quantity for ${it.medicine_name}.`);
        return;
      }
      if (Number(given) !== it.calculated_qty) {
        setError(`Confirmed quantity for ${it.medicine_name} must be ${it.calculated_qty}.`);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        patient_id: patient?.id,
        consultation_date: consultationDate,
        valid_until: validUntil || undefined,
        notes,
        items: items.map((it) => ({
          medicine: it.medicine,
          strength: it.strength,
          dosage_form: it.dosage_form,
          qty_per_dose: it.qty_per_dose,
          morning: it.morning,
          afternoon: it.afternoon,
          night: it.night,
          meal_timing: it.meal_timing,
          duration_days: it.duration_days,
          instructions: it.instructions,
          sort_order: it.sort_order,
        })),
      };
      const method = isNewDraft ? "POST" : "PATCH";
      const url = isNewDraft ? "/prescriptions" : `/prescriptions/${draftId}`;
      const rx = await api<Prescription>(url, { method, body: payload });
      // then finalize
      await api<Prescription>(`/prescriptions/${rx.id}/finalize`, {
        method: "POST",
        body: { items: rx.items.map((it: RxItem) => ({ item_id: it.id, confirmed_qty: it.total_qty })) },
      });
      router.push(`/doctor/prescriptions/${rx.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not finalize.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="doctor">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">
              {isNewDraft ? "New prescription" : "Edit draft"}
            </h1>
            <p className="text-sm text-ink-secondary">
              Structured digital prescription — immutable once finalized.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSaveDraft} loading={busy} disabled={busy}>
              Save draft
            </Button>
            <Button onClick={handleFinalize} loading={busy} disabled={busy}>
              Finalize
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        {allergyAlert && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">
              Allergy warning: a prescribed medicine matches this patient&apos;s recorded allergies.
            </p>
          </Card>
        )}

        {/* Patient selection */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">1. Patient</h2>
          {patient && (
            <>
              <p className="font-medium text-ink">{patient.name}</p>
              {patient.allergies && (
                <Badge variant="danger" className="mt-1 px-2 py-0.5">
                  Allergy: {patient.allergies}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
                Change patient
              </Button>
            </>
          )}
          {!patient && (
            <Input
              label="Select patient (id)"
              placeholder="Enter patient id"
              value={String((patient as Patient | null)?.id || "")}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!isNaN(id)) {
                  // load patient
                  api<Patient>(`/patients/${id}`).then((p) => setPatient(p));
                }
              }}
            />
          )}
        </Card>

        {/* Medicine search - simplified, no async search */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">2. Add medicine</h2>
          <Input
            label="Search by generic or brand name"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="e.g. paracetamol"
          />
          {medicines.length > 0 && (
            <ul className="mt-2 divide-y divide-border border border-border rounded-lg max-h-60 overflow-y-auto bg-bg-elevated">
              {medicines.map((m) => (
                <li key={m.id} className="px-4 py-3 tap-interactive hover:bg-accent/5 cursor-pointer" onClick={() => addMedicine(m)}>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-ink">{m.display_name}</span>
                    <span className="text-xs text-ink-secondary">{m.strength} · {m.dosage_form}</span>
                  </div>
                  <span className="text-xs text-ink-secondary">pack {m.pack_size} {m.pack_unit}</span>
                </li>
              ))}
            </ul>
          )}

          {items.length === 0 && (
            <p className="px-6 py-8 text-center text-ink-secondary">
              No medicines added yet.
            </p>
          )}

        </Card>

        {/* Dosage items */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">3. Dosage</h2>
            {items.length === 0 && (
              <p className="px-6 py-8 text-center text-ink-secondary">No medicines added yet.</p>
            )}
            {items.map((it, idx) => (
              <div key={it.id ?? idx} className="px-6 py-4 border-b border-border last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-ink">{it.medicine_name}</p>
                    <p className="text-xs text-ink-secondary">
                      {it.strength} · {it.dosage_form}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => removeItem(idx)}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Morning</label>
                    <input
                      type="number"
                      value={it.morning}
                      onChange={(e) => updateItem(idx, { morning: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Afternoon</label>
                    <input
                      type="number"
                      value={it.afternoon}
                      onChange={(e) => updateItem(idx, { afternoon: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Night</label>
                    <input
                      type="number"
                      value={it.night}
                      onChange={(e) => updateItem(idx, { night: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Days</label>
                    <input
                      type="number"
                      value={it.duration_days}
                      onChange={(e) => updateItem(idx, { duration_days: Number(e.target.value) || 1 })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Qty per dose</label>
                    <input
                      type="number"
                      step="0.1"
                      value={it.qty_per_dose}
                      onChange={(e) => updateItem(idx, { qty_per_dose: Number(e.target.value) || 1 })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Meal timing</label>
                    <select
                      value={it.meal_timing}
                      onChange={(e) => updateItem(idx, { meal_timing: e.target.value })}
                      className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm bg-bg-elevated"
                    >
                      <option value="before_food">Before food</option>
                      <option value="after_food">After food</option>
                      <option value="with_food">With food</option>
                      <option value="empty_stomach">Empty stomach</option>
                      <option value="at_bedtime">At bedtime</option>
                      <option value="as_needed">As needed</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-secondary block mb-1">Total qty</label>
                    <div className="flex items-end gap-1">
                      <span className="font-bold text-ink">{it.total_qty}</span>
                      <span className="text-xs text-ink-secondary">
                        {LIQUID_FORMS.has(it.dosage_form) ? "ml" : "tablets"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="text-xs text-ink-secondary block mb-1">Instructions</label>
                  <input
                    type="text"
                    value={it.instructions}
                    onChange={(e) => updateItem(idx, { instructions: e.target.value })}
                    className="w-full rounded border border-border px-2 py-1.5 text-ink text-sm"
                  />
                </div>
              </div>
            ))}
            <p className="px-6 pt-3 text-xs font-semibold text-ink-secondary">
              Calculated total: <span className="text-ink font-bold">{calculatedTotal}</span>
            </p>
          </Card>

          {/* Confirm quantities */}
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">4. Confirm quantities</h2>
            <p className="text-xs text-ink-secondary mb-4">
              Confirm the calculated quantity for each item before signing.
            </p>
            <div className="divide-y divide-border">
              {items.map((it, idx) => (
                <div key={it.id ?? idx} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-ink">{it.medicine_name}</p>
                    <p className="text-xs text-ink-secondary">Calculated: {it.calculated_qty}</p>
                  </div>
                  <input
                    type="number"
                    value={confirmed[it.id ?? idx] ?? ""}
                    onChange={(e) => handleConfirmQty(idx, e.target.value)}
                    className="w-24 rounded border border-border px-2 py-1.5 text-ink text-sm"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Dates */}
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">5. Dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Consultation date"
                type="date"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
              />
              <Input
                label="Valid until (max 180 days)"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </Card>

          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
      </div>
    </Shell>
  );
}

