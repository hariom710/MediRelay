"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface Batch {
  id: number;
  batch_number: string;
  expiry_date: string;
  qty: number;
  mrp: string;
  purchase_price: string;
  is_expired: boolean;
}

interface InventoryItem {
  id: number;
  medicine: number;
  medicine_name: string;
  selling_price: string;
  available_qty: number;
  batches: Batch[];
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api<InventoryItem[]>("/pharmacy/inventory")
      .then(setItems)
      .catch(() => setError("Could not load inventory."));
  }, []);

  const filtered = items?.filter((item) => {
    if (query && !item.medicine_name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "low") return item.available_qty < 10 && item.available_qty > 0;
    if (filter === "out") return item.available_qty === 0;
    if (filter === "expiring") return item.batches.some((b) => !b.is_expired && new Date(b.expiry_date) < new Date(Date.now() + 30 * 86400000));
    if (filter === "expired") return item.batches.some((b) => b.is_expired);
    return true;
  }) ?? [];

  return (
    <Shell role="pharmacy">
      <div className="max-w-4xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Inventory</h1>
            <p className="text-sm text-ink-secondary">Manage your pharmacy stock.</p>
          </div>
          <Button asChild>
            <Link href="/pharmacy/inventory/add">Add item</Link>
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
          </Card>
        )}

        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by medicine name" />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-border px-3 py-2.5 text-ink bg-bg-elevated text-sm"
          >
            <option value="all">All</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="expiring">Expiring in 30d</option>
            <option value="expired">Has expired</option>
          </select>
        </div>

        {items === null && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border text-ink-secondary">
            Loading…
          </div>
        )}

        {filtered.length === 0 && items && (
          <Card className="mb-6">
            <p className="p-8 text-center text-ink-secondary">No inventory items found.</p>
          </Card>
        )}

        {filtered.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {filtered.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/pharmacy/inventory/${item.id}`}
                    className="block px-6 py-4 tap-interactive hover:bg-accent/5"
                  >
                    <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">{item.medicine_name}</p>
                      <p className="text-xs text-ink-secondary">
                        Selling: ₹{item.selling_price} · Stock: {item.available_qty}
                      </p>
                      {item.batches.length > 0 && (
                        <p className="text-xs text-ink-secondary">
                          Nearest expiry: {item.batches[0].expiry_date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.available_qty === 0 ? (
                        <Badge variant="danger">Out of stock</Badge>
                      ) : item.available_qty < 10 ? (
                        <Badge variant="warning">Low stock</Badge>
                      ) : (
                        <Badge variant="success">In stock</Badge>
                      )}
                      {item.batches.some((b) => b.is_expired) && (
                        <Badge variant="danger">Expired present</Badge>
                      )}
                    </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}

