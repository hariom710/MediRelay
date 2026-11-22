"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  Building2,
  FileText,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Plus,
  Package,
  Layers,
  Calendar,
  XCircle,
  TrendingUp,
} from "lucide-react";

interface PrescriptionRequest {
  share_id: number;
  prescription_id: number;
  consultation_date: string;
  patient: string;
  item_count: number;
  expires_at: string;
  my_quotation_id: number | null;
  my_quotation_status: string | null;
}

interface ScopedRxDetails {
  id: number;
  consultation_date: string;
  patient_name: string;
  allergies: string;
  items: {
    id: number;
    medicine_id: number;
    medicine_name: string;
    generic_name: string;
    dosage_form: string;
    strength: string;
    total_qty: number;
    instructions: string;
  }[];
}

interface QuoteItemInput {
  prescription_item_id: number;
  available: boolean;
  qty_offered: number;
  unit_price: string;
  note: string;
}

export default function PharmacyPortal() {
  const [requests, setRequests] = useState<PrescriptionRequest[] | null>(null);
  const [selectedReq, setSelectedReq] = useState<PrescriptionRequest | null>(null);
  const [rxDetails, setRxDetails] = useState<ScopedRxDetails | null>(null);
  const [quoteItems, setQuoteItems] = useState<Record<number, QuoteItemInput>>({});
  const [pickupFee, setPickupFee] = useState("0");
  const [validDays, setValidDays] = useState(3);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Token Lookup State
  const [manualToken, setManualToken] = useState("");
  const [lookingUpToken, setLookingUpToken] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const res = await api<PrescriptionRequest[]>("/pharmacy/requests");
      setRequests(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  async function handleOpenRequest(req: PrescriptionRequest) {
    setSelectedReq(req);
    setLoadingDetails(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api<ScopedRxDetails>(`/prescriptions/${req.prescription_id}`);
      setRxDetails(res);

      // Pre-fill quotation items
      const initial: Record<number, QuoteItemInput> = {};
      res.items.forEach((it) => {
        initial[it.id] = {
          prescription_item_id: it.id,
          available: true,
          qty_offered: it.total_qty,
          unit_price: "10.00",
          note: "",
        };
      });
      setQuoteItems(initial);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleLookupToken(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setLookingUpToken(true);
    setError("");
    try {
      const res = await api<{
        share_id: number;
        prescription: ScopedRxDetails;
      }>(`/shares/${encodeURIComponent(manualToken.trim())}`);

      setSelectedReq({
        share_id: res.share_id,
        prescription_id: res.prescription.id,
        consultation_date: res.prescription.consultation_date,
        patient: res.prescription.patient_name,
        item_count: res.prescription.items.length,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        my_quotation_id: null,
        my_quotation_status: null,
      });
      setRxDetails(res.prescription);

      const initial: Record<number, QuoteItemInput> = {};
      res.prescription.items.forEach((it) => {
        initial[it.id] = {
          prescription_item_id: it.id,
          available: true,
          qty_offered: it.total_qty,
          unit_price: "10.00",
          note: "",
        };
      });
      setQuoteItems(initial);
      setSuccessMsg("Prescription verified via secure share token.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLookingUpToken(false);
    }
  }

  async function handleSubmitQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !rxDetails) return;
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const itemsPayload = Object.values(quoteItems).map((it) => ({
        prescription_item: it.prescription_item_id,
        available: it.available,
        qty_offered: it.qty_offered,
        unit_price: it.unit_price,
        note: it.note,
      }));

      // Step 1: Create draft quote
      const created = await api<{ id: number }>("/quotations", {
        method: "POST",
        body: {
          share_id: selectedReq.share_id,
          pickup_fee: Number(pickupFee) || 0,
          valid_days: validDays,
          items: itemsPayload,
        },
      });

      // Step 2: Submit quotation to patient
      await api(`/quotations/${created.id}/submit`, {
        method: "POST",
      });

      setSuccessMsg(`Quotation #${created.id} submitted successfully to patient.`);
      setSelectedReq(null);
      setRxDetails(null);
      loadRequests();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to submit quotation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell role="pharmacy">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Pharmacy Prescription Requests
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Review scoped prescription requests, submit competitive batch quotations, and fulfill customer orders.
          </p>
        </div>
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

      {/* Manual Token Verification Search Bar */}
      <div className="mb-8 rounded-3xl border border-black/[0.06] bg-white/70 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/50 shadow-xs">
        <form onSubmit={handleLookupToken} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Enter customer share token directly (e.g. from patient app or printed QR)…"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="w-full rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-xs text-zinc-800 shadow-xs focus:border-purple-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-950 dark:text-white"
          />
          <button
            type="submit"
            disabled={lookingUpToken}
            className="tap-interactive shrink-0 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-500/20 hover:bg-purple-500 disabled:opacity-50"
          >
            {lookingUpToken ? "Verifying…" : "Verify Token"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Requests Inbox (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Incoming Requests ({requests?.length ?? 0})
          </h2>

          {requests === null ? (
            <p className="p-4 text-xs text-zinc-400">Loading requests…</p>
          ) : requests.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Building2 className="mx-auto h-7 w-7 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No active prescription requests
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                When patients share prescriptions with your branch, requests will show up here.
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const isSelected = selectedReq?.share_id === req.share_id;
              const hasQuoted = req.my_quotation_id !== null;
              return (
                <button
                  type="button"
                  key={req.share_id}
                  onClick={() => handleOpenRequest(req)}
                  className={`tap-interactive w-full rounded-2xl p-4 text-left border transition-all ${
                    isSelected
                      ? "border-purple-600 bg-white dark:bg-zinc-900 shadow-md ring-2 ring-purple-500/20"
                      : "border-black/[0.06] bg-white/70 hover:bg-white dark:border-white/[0.08] dark:bg-zinc-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">
                      RX-{req.prescription_id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        hasQuoted
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      }`}
                    >
                      {hasQuoted ? `Quoted (${req.my_quotation_status})` : "Pending Quote"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Patient: {req.patient} · {req.item_count} items
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Consultation: {req.consultation_date}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Quotation Submission Studio (7 cols) */}
        <div className="lg:col-span-7">
          {selectedReq && rxDetails ? (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-start justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    Quotation Builder for RX-{rxDetails.id}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Patient: {rxDetails.patient_name} {rxDetails.allergies && `(Allergies: ${rxDetails.allergies})`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedReq(null);
                    setRxDetails(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitQuotation} className="mt-6 space-y-6">
                {/* Scoped Items List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Prescribed Items & Availability
                  </h4>
                  {rxDetails.items.map((it) => {
                    const q = quoteItems[it.id] || {
                      prescription_item_id: it.id,
                      available: true,
                      qty_offered: it.total_qty,
                      unit_price: "10.00",
                      note: "",
                    };
                    return (
                      <div
                        key={it.id}
                        className="rounded-2xl border border-black/[0.06] bg-zinc-50/70 p-4 dark:border-white/[0.08] dark:bg-zinc-900/40"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-bold text-xs text-zinc-900 dark:text-white">
                              {it.medicine_name}
                            </span>
                            <span className="text-[11px] text-zinc-400 ml-2">
                              ({it.strength} · Required: {it.total_qty} units)
                            </span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={q.available}
                              onChange={(e) =>
                                setQuoteItems((prev) => ({
                                  ...prev,
                                  [it.id]: { ...q, available: e.target.checked },
                                }))
                              }
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span>In Stock</span>
                          </label>
                        </div>

                        {q.available && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                                Qty Offered
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={q.qty_offered}
                                onChange={(e) =>
                                  setQuoteItems((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      ...q,
                                      qty_offered: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                                Unit Price (₹)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={q.unit_price}
                                onChange={(e) =>
                                  setQuoteItems((prev) => ({
                                    ...prev,
                                    [it.id]: { ...q, unit_price: e.target.value },
                                  }))
                                }
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                                Batch / Remarks
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Batch #B42"
                                value={q.note}
                                onChange={(e) =>
                                  setQuoteItems((prev) => ({
                                    ...prev,
                                    [it.id]: { ...q, note: e.target.value },
                                  }))
                                }
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pickup / Delivery Fee & Validity */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Fulfillment / Pickup Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pickupFee}
                      onChange={(e) => setPickupFee(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Quotation Validity (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={validDays}
                      onChange={(e) => setValidDays(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs dark:border-white/[0.1] dark:bg-zinc-950"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="tap-interactive flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-500/20 hover:bg-purple-500 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Submitting Quotation…" : "Submit Quotation to Patient"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-12 text-center text-xs text-zinc-400">
              Select a prescription request from the inbox or verify a customer token above.
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
