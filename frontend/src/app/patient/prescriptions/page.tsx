"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  FileText,
  Share2,
  TrendingDown,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Percent,
  Layers,
  ChevronRight,
  Info,
  Calendar,
} from "lucide-react";

interface Prescription {
  id: number;
  status: string;
  version: number;
  consultation_date: string;
  notes: string;
  items: {
    id: number;
    medicine_name: string;
    strength: string;
    dosage_form: string;
    total_qty: number;
    instructions: string;
  }[];
}

interface SinglePharmacyQuote {
  pharmacy_id: number;
  pharmacy_name: string;
  medicine_total: string;
  pickup_fee: string;
  grand_total: string;
  items: {
    prescription_item_id: number;
    medicine_name: string;
    available: boolean;
    unit_price: string;
    line_total: string;
  }[];
}

interface MultiPharmacyCombination {
  pharmacies: {
    pharmacy_id: number;
    pharmacy_name: string;
    pickup_fee: string;
    item_count: number;
  }[];
  medicines_total: string;
  fees_total: string;
  grand_total: string;
  savings_vs_single: string;
  items: {
    prescription_item_id: number;
    medicine_name: string;
    pharmacy_id: number;
    pharmacy_name: string;
    unit_price: string;
    line_total: string;
  }[];
}

interface ComparisonResult {
  prescription_id: number;
  single_best: SinglePharmacyQuote | null;
  multi_best: MultiPharmacyCombination | null;
  quotations_count: number;
}

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: number; total: string } | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [shareToken, setShareToken] = useState("");

  const loadComparison = useCallback(async (rxId: number) => {
    setLoadingCompare(true);
    setComparison(null);
    try {
      const res = await api<ComparisonResult>("/price-comparisons", {
        method: "POST",
        body: JSON.stringify({ prescription_id: rxId }),
      });
      setComparison(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoadingCompare(false);
    }
  }, []);

  const loadPrescriptions = useCallback(async () => {
    try {
      const res = await api<Prescription[]>("/prescriptions");
      setPrescriptions(res);
      if (res.length > 0 && !selectedRx) {
        setSelectedRx(res[0]);
        loadComparison(res[0].id);
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }, [selectedRx, loadComparison]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  function handleSelectRx(rx: Prescription) {
    setSelectedRx(rx);
    loadComparison(rx.id);
    setOrderSuccess(null);
  }

  async function handleOrder(mode: "single" | "multi") {
    if (!comparison || !selectedRx) return;
    setOrdering(true);
    setError("");

    try {
      let selection: { prescription_item: number; pharmacy: number }[] = [];
      if (mode === "single" && comparison.single_best) {
        selection = comparison.single_best.items.map((it) => ({
          prescription_item: it.prescription_item_id,
          pharmacy: comparison.single_best!.pharmacy_id,
        }));
      } else if (mode === "multi" && comparison.multi_best) {
        selection = comparison.multi_best.items.map((it) => ({
          prescription_item: it.prescription_item_id,
          pharmacy: it.pharmacy_id,
        }));
      }

      const res = await api<{ id: number; total: string }>("/orders", {
        method: "POST",
        body: {
          prescription_id: selectedRx.id,
          selection,
        },
      });

      setOrderSuccess(res);
      setSuccessMsg(`Order ORD-${res.id} placed successfully! Stock reserved.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to place order.");
    } finally {
      setOrdering(false);
    }
  }

  async function handleCreateShare(rxId: number) {
    setError("");
    try {
      const res = await api<{ token: string; expires_at: string }>(
        `/prescriptions/${rxId}/shares`,
        {
          method: "POST",
          body: { valid_days: 7 },
        },
      );
      setShareToken(res.token);
      setSuccessMsg("New share token generated. Pharmacies can now view and submit quotes.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  return (
    <PortalShell role="patient">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Prescriptions & Smart Price Comparison
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Compare real-time quotations across verified pharmacies and find the most cost-effective fulfillment.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
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

      {/* Share Token Banner */}
      {shareToken && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-900 dark:text-blue-200">
              Share Token for Pharmacies: <strong className="font-mono">{shareToken}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareToken);
              setSuccessMsg("Copied share token to clipboard!");
            }}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-blue-500"
          >
            Copy
          </button>
        </div>
      )}

      {/* Main 2-Column Layout: Left (Prescription Cards), Right (Comparison Studio) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Prescriptions Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            My Prescriptions
          </h2>

          {prescriptions === null ? (
            <p className="p-4 text-xs text-zinc-400">Loading prescriptions…</p>
          ) : prescriptions.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-center">
              <FileText className="mx-auto h-7 w-7 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No prescriptions yet</p>
              <p className="text-[11px] text-zinc-400 mt-1">Prescriptions issued by your doctor will appear here automatically.</p>
            </div>
          ) : (
            prescriptions.map((rx) => {
              const isSelected = selectedRx?.id === rx.id;
              return (
                <button
                  type="button"
                  key={rx.id}
                  onClick={() => handleSelectRx(rx)}
                  className={`tap-interactive w-full rounded-2xl p-4 text-left border transition-all ${
                    isSelected
                      ? "border-blue-600 bg-white dark:bg-zinc-900 shadow-md ring-2 ring-blue-500/20"
                      : "border-black/[0.06] bg-white/70 hover:bg-white dark:border-white/[0.08] dark:bg-zinc-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">
                      RX-{rx.id} (v{rx.version})
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        rx.status === "finalized"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {rx.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Date: {rx.consultation_date}</p>
                  <p className="text-[11px] text-zinc-400 mt-1">{rx.items?.length || 0} prescribed medicines</p>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Prescription Details & Comparison Studio (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedRx ? (
            <div className="space-y-6">
              {/* Prescription Summary Card */}
              <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      Prescription RX-{selectedRx.id}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Consultation Date: {selectedRx.consultation_date} · Status: {selectedRx.status}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCreateShare(selectedRx.id)}
                    className="tap-interactive inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share with Pharmacies
                  </button>
                </div>

                {/* Items */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedRx.items?.map((it) => (
                    <div
                      key={it.id}
                      className="rounded-xl bg-zinc-50/80 p-3 text-xs dark:bg-zinc-900/60 border border-black/[0.04] dark:border-white/[0.06]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900 dark:text-white">{it.medicine_name}</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{it.total_qty} units</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{it.strength} · {it.instructions}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Success Confirmation Banner */}
              {orderSuccess && (
                <div className="rounded-3xl border border-emerald-300 bg-emerald-50/80 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 dark:text-emerald-100">
                        Order Placed: ORD-{orderSuccess.id}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Total Amount: ₹{orderSuccess.total} · Real-time stock reserved at selected pharmacies.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Comparison Studio */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                      Price Comparison Engine
                    </h3>
                  </div>
                  {comparison && (
                    <span className="text-xs text-zinc-400">
                      {comparison.quotations_count} pharmacy quotations evaluated
                    </span>
                  )}
                </div>

                {loadingCompare ? (
                  <div className="glass-panel rounded-3xl p-10 text-center text-xs text-zinc-400">
                    Running comparison optimizer across live pharmacy quotations…
                  </div>
                ) : !comparison || (!comparison.single_best && !comparison.multi_best) ? (
                  <div className="glass-panel rounded-3xl p-10 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      No pharmacy quotations available yet
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                      Click &ldquo;Share with Pharmacies&rdquo; above. When local pharmacies submit their quotations, the comparison engine will calculate your optimal price.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Mode 1: Cheapest Complete Pharmacy */}
                    {comparison.single_best && (
                      <div className="glass-panel rounded-3xl p-6 border-2 border-blue-500/30 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 rounded-bl-2xl bg-blue-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
                          Single Pharmacy
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                              {comparison.single_best.pharmacy_name}
                            </h4>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Covers 100% of prescribed items in one single stop.
                          </p>

                          <div className="mt-4 space-y-1.5 border-t border-black/[0.04] dark:border-white/[0.06] pt-3 text-xs">
                            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>Medicines Total</span>
                              <span>₹{comparison.single_best.medicine_total}</span>
                            </div>
                            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>Pickup / Fulfillment Fee</span>
                              <span>₹{comparison.single_best.pickup_fee}</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm text-zinc-900 dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                              <span>Grand Total</span>
                              <span className="text-blue-600 dark:text-blue-400">₹{comparison.single_best.grand_total}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={ordering}
                          onClick={() => handleOrder("single")}
                          className="tap-interactive mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50"
                        >
                          {ordering ? "Reserving Stock…" : `Order from ${comparison.single_best.pharmacy_name}`}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Mode 2: Multi-Pharmacy Optimizer */}
                    {comparison.multi_best && (
                      <div className="glass-panel rounded-3xl p-6 border-2 border-emerald-500/30 flex flex-col justify-between relative overflow-hidden bg-emerald-50/20 dark:bg-emerald-950/10">
                        <div className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Maximum Savings
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-emerald-600" />
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                              Multi-Store Combination
                            </h4>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Split across {comparison.multi_best.pharmacies.length} pharmacies for optimal unit prices.
                          </p>

                          {/* Pharmacy Breakdown */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {comparison.multi_best.pharmacies.map((p) => (
                              <span
                                key={p.pharmacy_id}
                                className="rounded-lg bg-emerald-100/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              >
                                {p.pharmacy_name} ({p.item_count} items)
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 space-y-1.5 border-t border-black/[0.04] dark:border-white/[0.06] pt-3 text-xs">
                            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>Medicines Total</span>
                              <span>₹{comparison.multi_best.medicines_total}</span>
                            </div>
                            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>Combined Fees</span>
                              <span>₹{comparison.multi_best.fees_total}</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm text-zinc-900 dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                              <span>Grand Total</span>
                              <span className="text-emerald-600 dark:text-emerald-400">₹{comparison.multi_best.grand_total}</span>
                            </div>
                            {Number(comparison.multi_best.savings_vs_single) > 0 && (
                              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                You save ₹{comparison.multi_best.savings_vs_single} vs single pharmacy!
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={ordering}
                          onClick={() => handleOrder("multi")}
                          className="tap-interactive mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {ordering ? "Reserving Stock…" : "Order Combination"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-12 text-center text-xs text-zinc-400">
              Select a prescription from the left to view details and price comparisons.
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
