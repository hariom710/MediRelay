"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";
import { type InventoryItem, type Batch } from "@/lib/types";

export default function InventoryDetail({ params }: { params: { id: string } }) {
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
    api<InventoryItem>(`/pharmacy/inventory/${params.id}`)
      .then(setItem)
      .catch(() => setError("Could not load inventory item."));
  }, [params.id]);

  async function handleAddBatch() {
    if (!batchNumber || !expiryDate || !qty) {
      setError("Batch number, expiry date, and quantity are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/inventory/${params.id}/batches`, {
        method: "POST",
        body: { batch_number: batchNumber, expiry_date: expiryDate, qty: Number(qty), mrp: mrp || "0", purchase_price: purchasePrice || "0" },
      });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${params.id}`);
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
      await api(`/pharmacy/inventory/${params.id}/adjust/${adjustBatch}`, {
        method: "POST",
        body: { quantity: Number(adjustQty), reason: adjustReason },
      });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${params.id}`);
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
      await api(`/pharmacy/inventory/${params.id}/expire/${batchId}`, { method: "POST" });
      const updated = await api<InventoryItem>(`/pharmacy/inventory/${params.id}`);
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
      await api(`/pharmacy/inventory/${params.id}`, { method: "DELETE" });
      window.location.href = "/pharmacy/inventory";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete item.");
    } finally {
      setBusy(false);
    }
  }

  if (item === null && !error) {
    return (
      <Shell role="pharmacy">
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-8 w-8 rounded border-border" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role="pharmacy">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">{item?.medicine_name}</h1>
            <p className="text-sm text-ink-secondary">Selling price: ₹{item?.selling_price} · Available: {item?.available_qty}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleDelete} loading={busy} disabled={busy}>
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        {/* Batches */}
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-ink">Batches</h2>
            <Button size="sm" onClick={() => setShowBatchForm(!showBatchForm)}>
              {showBatchForm ? "Cancel" : "Add batch"}
            </Button>
          </div>

          {showBatchForm && (
            <div className="mb-4 p-4 rounded border border-border bg-bg-elevated space-y-3">
              <Input label="Batch number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
              <Input label="Expiry date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              <Input label="Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Input label="MRP" type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} />
              <Input label="Purchase price" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
              <Button onClick={handleAddBatch} loading={busy} disabled={busy} size="sm">Add</Button>
            </div>
          )}

          {item?.batches.length === 0 ? (
            <p className="px-6 py-8 text-center text-ink-secondary">No batches yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {item?.batches.map((b) => (
                <li key={b.id} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">Batch {b.batch_number}</p>
                      <p className="text-xs text-ink-secondary">
                        Expiry: {b.expiry_date} · Qty: {b.qty} · MRP: ₹{b.mrp} · Purchase: ₹{b.purchase_price}
                      </p>
                      {b.is_expired && <Badge variant="danger" className="mt-1">Expired</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setAdjustBatch(b.id)}>
                        Adjust
                      </Button>
                      {b.is_expired && b.qty > 0 && (
                        <Button size="sm" variant="danger" onClick={() => handleExpire(b.id)} disabled={busy}>
                          Write off
                        </Button>
                      )}
                    </div>
                  </div>
                  {adjustBatch === b.id && (
                    <div className="mt-3 p-3 rounded border border-border bg-bg-elevated space-y-2">
                      <Input label="Quantity (+/-)" type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                      <Input label="Reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="damage, count correction, etc." />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAdjust} loading={busy} disabled={busy}>Apply</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAdjustBatch(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Stock ledger */}
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Stock ledger</h2>
          <p className="px-6 py-4 text-sm text-ink-secondary">
            Stock movements are recorded automatically. View the full ledger via the API.
          </p>
        </Card>
      </div>
    </Shell>
  );
}