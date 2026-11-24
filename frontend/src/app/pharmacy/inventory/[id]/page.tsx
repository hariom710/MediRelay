"use client";

import { useEffect, useState, use, Suspense } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import { type InventoryItem, type Batch } from "@/lib/types";

function InventoryDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [mrp, setMrp] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [adjustBatch, setAdjustBatch] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => {
    if (!id) return;
    api<InventoryItem>(`/pharmacy/inventory/${id}`)
      .then(setItem)
      .catch(() => setError("Could not load inventory item."));
  }, [id]);

  async function handleAddBatch() {
    if (!batchNumber || !expiryDate || !qty) {
      setError("Batch number, expiry date, and quantity are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/inventory/${id}/batches`, {
        method: "POST",
        body: { batch_number: batchNumber, expiry_date: expiryDate, qty: Number(qty), mrp: mrp || "0", purchase_price: purchasePrice || "0" },
      });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${id}`);
      setItem(updated);
      setShowBatchForm(false);
      setBatchNumber("");
      setExpiryDate("");
      setQty("");
      setMrp("");
      setPurchasePrice("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add batch.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjust() {
    if (!adjustBatch || !adjustQty || !adjustReason) {
      setError("Quantity and reason are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/inventory/${id}/adjust/${adjustBatch}`, {
        method: "POST",
        body: { quantity: Number(adjustQty), reason: adjustReason },
      });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${id}`);
      setItem(updated);
      setAdjustBatch(null);
      setAdjustQty("");
      setAdjustReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not adjust stock.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExpire(batchId: number) {
    if (!window.confirm("Write off this expired batch?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/inventory/${id}/expire/${batchId}`, { method: "POST" });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${id}`);
      setItem(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not write off batch.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/inventory/${id}`, { method: "DELETE" });
      window.location.href = "/pharmacy/inventory";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete item.");
    } finally {
      setBusy(false);
    }
  }

  if (item === null && !error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 rounded border-border" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">
            {item?.medicine_name || "Medicine Item"}
          </h1>
          <p className="text-sm text-ink-secondary">
            {item?.dosage_form || "Dosage"} · {item?.strength || "Strength"}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowBatchForm(!showBatchForm)}>
            {showBatchForm ? "Cancel batch" : "Add batch"}
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={busy} disabled={busy}>
            Delete item
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6">
          <p className="p-4 text-sm text-danger">{error}</p>
        </Card>
      )}

      {showBatchForm && (
        <Card className="mb-6 p-6">
          <h2 className="text-base font-semibold mb-4">Add new medicine batch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Batch Number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required />
            <Input label="Expiry Date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
            <Input label="Quantity" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
            <Input label="MRP (₹)" type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} />
            <Input label="Purchase Price (₹)" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleAddBatch} loading={busy} disabled={busy}>Save batch</Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Batches (FEFO order)</h2>
        {item?.batches && item.batches.length > 0 ? (
          <div className="divide-y divide-border">
            {item.batches.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{b.batch_number}</span>
                  <span className="ml-3 text-ink-secondary">Exp: {b.expiry_date}</span>
                  <span className="ml-3 font-mono font-bold">{b.qty} in stock</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.status === "active" ? "success" : b.status === "depleted" ? "neutral" : "danger"}>
                    {b.status.toUpperCase()}
                  </Badge>
                  {b.status === "active" && (
                    <Button size="sm" variant="ghost" onClick={() => setAdjustBatch(b.id)}>
                      Adjust
                    </Button>
                  )}
                  {b.is_expired && b.status !== "written_off" && (
                    <Button size="sm" variant="danger" onClick={() => handleExpire(b.id)}>
                      Write off
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-secondary">No active batches for this medicine.</p>
        )}
      </Card>
    </div>
  );
}

export default function InventoryDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell role="pharmacy">
      <Suspense fallback={<div className="p-8 text-xs text-ink-secondary">Loading inventory…</div>}>
        <InventoryDetailInner params={params} />
      </Suspense>
    </Shell>
  );
}
