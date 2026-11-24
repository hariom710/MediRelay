"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Shell from "@/components/shell";

interface RxItem {
  id: number;
  medicine: number;
  medicine_name: string;
  strength: string;
  dosage_form: string;
  total_qty: number;
}

interface RxDetail {
  id: number;
  patient_display: string;
  status: string;
  items: RxItem[];
}

function QuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rxId = searchParams.get("prescription_id");

  const [rx, setRx] = useState<RxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pickupFee, setPickupFee] = useState("0");
  const [validDays, setValidDays] = useState("3");
  const [itemForms, setItemForms] = useState<
    Record<
      number,
      { unit_price: string; qty_offered: string; batch_number: string; available: boolean }
    >
  >({});

  useEffect(() => {
    if (!rxId) return;

    api<RxDetail>(`/prescriptions/${rxId}`)
      .then((data) => {
        setRx(data);
        const initialForms: Record<
          number,
          { unit_price: string; qty_offered: string; batch_number: string; available: boolean }
        > = {};
        for (const it of data.items || []) {
          initialForms[it.id] = {
            unit_price: "10.00",
            qty_offered: String(it.total_qty),
            batch_number: "",
            available: true,
          };
        }
        setItemForms(initialForms);
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Could not load prescription details.");
      })
      .finally(() => setLoading(false));
  }, [rxId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rxId || !rx) return;

    setSubmitting(true);
    setError("");

    try {
      const itemsPayload = rx.items.map((it) => {
        const form = itemForms[it.id] || {
          unit_price: "0",
          qty_offered: "0",
          batch_number: "",
          available: false,
        };
        return {
          prescription_item: it.id,
          available: form.available,
          unit_price: Number(form.unit_price) || 0,
          qty_offered: Number(form.qty_offered) || 0,
          batch_number: form.batch_number.trim() || undefined,
        };
      });

      await api("/quotations", {
        method: "POST",
        body: {
          prescription: Number(rxId),
          pickup_fee: Number(pickupFee) || 0,
          valid_days: Number(validDays) || 3,
          submit: true,
          items: itemsPayload,
        },
      });

      router.push("/pharmacy/quotations");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to submit quotation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Pharmacy Quotation</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Quote unit prices and verify inventory availability for Prescription #{rxId}
          </p>
        </div>
        <Link href="/pharmacy/quotations">
          <Button variant="ghost" size="sm">Back</Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 border-red-500/20 bg-red-50 text-red-700 text-xs font-medium">
          {error}
        </Card>
      )}

      {!rxId ? (
        <Card className="p-8 text-center text-xs text-[var(--text-tertiary)]">
          Missing prescription ID.
        </Card>
      ) : loading ? (
        <Card className="p-8 text-center text-xs text-[var(--text-tertiary)]">
          Loading prescription items…
        </Card>
      ) : rx ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold border-b border-[var(--border)] pb-2">
              Quotation Terms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Pickup / Handling Fee (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pickupFee}
                  onChange={(e) => setPickupFee(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Validity Period (Days, 1-14)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="14"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold border-b border-[var(--border)] pb-2">
              Line Items
            </h2>
            <div className="divide-y divide-[var(--border)]">
              {rx.items.map((it) => {
                const current = itemForms[it.id] || {
                  unit_price: "0",
                  qty_offered: String(it.total_qty),
                  batch_number: "",
                  available: true,
                };

                return (
                  <div key={it.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-xs text-[var(--text)]">{it.medicine_name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          {it.dosage_form} • {it.strength} • Required: {it.total_qty} units
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={current.available}
                          onChange={(e) =>
                            setItemForms({
                              ...itemForms,
                              [it.id]: { ...current, available: e.target.checked },
                            })
                          }
                          className="rounded border-[var(--border)] text-[var(--accent)]"
                        />
                        <span className="font-medium">Available</span>
                      </label>
                    </div>

                    {current.available && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-[var(--text-tertiary)]">Unit Price (₹)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={current.unit_price}
                            onChange={(e) =>
                              setItemForms({
                                ...itemForms,
                                [it.id]: { ...current, unit_price: e.target.value },
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[var(--text-tertiary)]">Qty Offered</label>
                          <Input
                            type="number"
                            min="1"
                            value={current.qty_offered}
                            onChange={(e) =>
                              setItemForms({
                                ...itemForms,
                                [it.id]: { ...current, qty_offered: e.target.value },
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[var(--text-tertiary)]">Batch No (optional)</label>
                          <Input
                            type="text"
                            placeholder="e.g. B001"
                            value={current.batch_number}
                            onChange={(e) =>
                              setItemForms({
                                ...itemForms,
                                [it.id]: { ...current, batch_number: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/pharmacy/quotations">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" loading={submitting} pill>
              Submit Quotation
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Shell role="pharmacy">
      <Suspense fallback={<Card className="p-8 text-center text-xs">Loading form…</Card>}>
        <QuotationForm />
      </Suspense>
    </Shell>
  );
}
