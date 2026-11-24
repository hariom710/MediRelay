"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import Shell from "@/components/shell";

interface PrescriptionItem {
  id: number;
  medicine_name: string;
  dosage_form: string;
  strength: string;
  total_qty: number;
  instructions: string;
}

interface Prescription {
  id: number;
  status: string;
  version: number;
  consultation_date: string;
  notes?: string;
  doctor_name?: string;
  items?: PrescriptionItem[];
}

interface ComparisonResult {
  single_best: {
    pharmacy_id: number;
    pharmacy_name: string;
    total_price: string;
    pickup_fee: string;
    grand_total: string;
    items: {
      prescription_item_id: number;
      unit_price: string;
      line_total: string;
    }[];
  } | null;
  multi_best: {
    grand_total: string;
    items: {
      prescription_item_id: number;
      pharmacy_id: number;
      pharmacy_name: string;
      unit_price: string;
      line_total: string;
    }[];
  } | null;
}

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [selectedRxId, setSelectedRxId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [shareToken, setShareToken] = useState<{ rxId: number; token: string } | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadPrescriptions = useCallback(async () => {
    try {
      const data = await api<Prescription[]>("/prescriptions");
      setPrescriptions(data);
      if (data.length > 0 && selectedRxId === null) {
        setSelectedRxId(data[0].id);
        fetchComparison(data[0].id);
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }, [selectedRxId]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  async function fetchComparison(rxId: number) {
    setLoadingCompare(true);
    setComparison(null);
    try {
      const res = await api<ComparisonResult>("/price-comparisons", {
        method: "POST",
        body: { prescription_id: rxId },
      });
      setComparison(res);
    } catch {
      // No quotations submitted yet
    } finally {
      setLoadingCompare(false);
    }
  }

  async function handleShare(rxId: number) {
    setError("");
    try {
      const res = await api<{ token: string; share_id: number }>(
        `/prescriptions/${rxId}/shares`,
        {
          method: "POST",
          body: { valid_days: 7 },
        }
      );
      setShareToken({ rxId, token: res.token });
      navigator.clipboard.writeText(res.token);
      setSuccessMsg(`Share token copied! RX-${rxId} can now be quoted by pharmacies.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  const [ordering, setOrdering] = useState(false);

  async function handleOrder(selection: { prescription_item: number; pharmacy: number }[]) {
    if (!selectedRxId) return;
    setOrdering(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api<any>("/orders", {
        method: "POST",
        body: {
          prescription_id: selectedRxId,
          selection,
        },
      });
      setSuccessMsg(`Order #${res.id || "created"} placed successfully! Fulfillments scheduled.`);
      fetchComparison(selectedRxId);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to place order.");
    } finally {
      setOrdering(false);
    }
  }

  const selectedRx = prescriptions?.find((r) => r.id === selectedRxId);

  return (
    <Shell role="patient">
      <div className="space-y-8 max-w-5xl">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="type-h1 text-[var(--text)]">Prescriptions & Quotes</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              View doctor-verified digital prescriptions, share securely with local pharmacies, and compare prices.
            </p>
          </div>

          <Badge variant="success" size="md">
            Cryptographic Privacy Active
          </Badge>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20"
          >
            <span>⚠ {error}</span>
            <button onClick={() => setError("")} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center justify-between rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-medium text-[var(--success)] border border-[var(--success)]/30"
          >
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        {/* Share Token Copy Banner */}
        {shareToken && (
          <div className="rounded-[var(--r-xl)] border border-[var(--accent)]/30 bg-[var(--accent-subtle)] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">
                Active Share Token for RX-{shareToken.rxId}
              </span>
              <button
                onClick={() => setShareToken(null)}
                className="text-xs text-[var(--text-secondary)] hover:underline"
              >
                Dismiss
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Provide this 32-byte cryptographic token to any licensed pharmacy to receive itemized quotations.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareToken.token}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-mono text-xs text-[var(--text)] select-all"
              />
              <Button
                size="sm"
                pill
                onClick={() => {
                  navigator.clipboard.writeText(shareToken.token);
                  setSuccessMsg("Copied share token to clipboard.");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        )}

        {/* Main Content: Loading, Empty, or Prescriptions Grid */}
        {prescriptions === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-[var(--r-2xl)] md:col-span-1" />
            <Skeleton className="h-64 rounded-[var(--r-2xl)] md:col-span-2" />
          </div>
        ) : prescriptions.length === 0 ? (
          <EmptyState
            title="No Prescriptions Found"
            description="Your doctor will create and finalize structured digital prescriptions for you. Once ready, they will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Prescription List Selector */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                Prescription History ({prescriptions.length})
              </h3>

              <div className="space-y-2">
                {prescriptions.map((rx) => {
                  const isSelected = rx.id === selectedRxId;
                  const isFinalized = rx.status === "finalized";
                  return (
                    <div
                      key={rx.id}
                      onClick={() => {
                        setSelectedRxId(rx.id);
                        fetchComparison(rx.id);
                      }}
                      className={`tap-interactive rounded-[var(--r-xl)] p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--bg-elevated)] shadow-xs ring-1 ring-[var(--accent)]/30"
                          : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-[var(--text)]">
                          RX-{rx.id}
                        </span>
                        <Badge
                          variant={
                            isFinalized
                              ? "finalized"
                              : rx.status === "cancelled"
                              ? "cancelled"
                              : "draft"
                          }
                          size="sm"
                        >
                          {rx.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)]">
                        v{rx.version} · {rx.consultation_date}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Prescription Detail & Quotations */}
            {selectedRx && (
              <div className="lg:col-span-2 space-y-6">
                <Card elevated className="border border-[var(--border)] bg-[var(--bg-elevated)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
                          Prescription RX-{selectedRx.id}
                        </h2>
                        <span className="font-mono text-xs text-[var(--text-tertiary)]">
                          v{selectedRx.version}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Consultation Date: {selectedRx.consultation_date}
                        {selectedRx.notes && ` · Notes: ${selectedRx.notes}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedRx.status === "finalized" && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            pill
                            onClick={() =>
                              window.open(`/api/v1/prescriptions/${selectedRx.id}/pdf`, "_blank")
                            }
                          >
                            PDF Receipt
                          </Button>
                          <Button
                            size="sm"
                            pill
                            onClick={() => handleShare(selectedRx.id)}
                          >
                            Share Link
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price Comparison Summary */}
                  <div className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold tracking-tight text-[var(--text)]">
                        Pharmacy Price Comparison Engine
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={loadingCompare}
                        onClick={() => fetchComparison(selectedRx.id)}
                      >
                        Refresh Quotes
                      </Button>
                    </div>

                    {loadingCompare ? (
                      <Skeleton className="h-32 rounded-[var(--r-xl)]" />
                    ) : comparison?.single_best || comparison?.multi_best ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Mode 1 Card */}
                        {comparison.single_best && (
                          <div className="rounded-[var(--r-xl)] border border-[var(--accent)]/30 bg-[var(--accent-subtle)] p-5 flex flex-col justify-between">
                            <div>
                              <Badge variant="finalized" size="sm">
                                Single Store Winner
                              </Badge>
                              <h5 className="mt-2 text-base font-bold text-[var(--text)]">
                                {comparison.single_best.pharmacy_name}
                              </h5>
                              <p className="mt-1 text-2xl font-bold font-mono text-[var(--accent)]">
                                ₹{comparison.single_best.grand_total}
                              </p>
                              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                Pickup Fee: ₹{comparison.single_best.pickup_fee}
                              </p>
                            </div>
                            <Button
                              className="mt-4"
                              size="sm"
                              pill
                              loading={ordering}
                              onClick={() => {
                                if (!comparison.single_best) return;
                                const pid = comparison.single_best.pharmacy_id;
                                const sel = comparison.single_best.items.map((it) => ({
                                  prescription_item: it.prescription_item_id,
                                  pharmacy: pid,
                                }));
                                handleOrder(sel);
                              }}
                            >
                              Order Single Store
                            </Button>
                          </div>
                        )}

                        {/* Mode 2 Card */}
                        {comparison.multi_best && (
                          <div className="rounded-[var(--r-xl)] border border-[var(--success)]/30 bg-[var(--success-subtle)] p-5 flex flex-col justify-between">
                            <div>
                              <Badge variant="success" size="sm">
                                Multi-Store Combination
                              </Badge>
                              <h5 className="mt-2 text-base font-bold text-[var(--text)]">
                                Optimal Combined Split
                              </h5>
                              <p className="mt-1 text-2xl font-bold font-mono text-[var(--success)]">
                                ₹{comparison.multi_best.grand_total}
                              </p>
                              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                Calculated across competing stores
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              className="mt-4"
                              size="sm"
                              pill
                              loading={ordering}
                              onClick={() => {
                                if (!comparison.multi_best) return;
                                const sel = comparison.multi_best.items.map((it) => ({
                                  prescription_item: it.prescription_item_id,
                                  pharmacy: it.pharmacy_id,
                                }));
                                handleOrder(sel);
                              }}
                            >
                              Order Combined Split
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-[var(--r-xl)] border border-dashed border-[var(--border)] p-6 text-center">
                        <p className="text-xs font-medium text-[var(--text-secondary)]">
                          No quotations submitted yet for this prescription.
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                          Click &ldquo;Share Link&rdquo; above and send the token to participating pharmacies.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
