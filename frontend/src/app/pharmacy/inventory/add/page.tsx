"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Shell from "@/components/shell";
import { type Medicine } from "@/lib/types";

export default function AddInventoryItem() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = search ? `/medicines/search?q=${encodeURIComponent(search)}` : "/medicines/search";
    api<Medicine[]>(url).then(setMedicines).catch(() => setError("Could not load medicines."));
  }, [search]);

  const filtered = medicines.filter((m) =>
    m.display_name.toLowerCase().includes(search.toLowerCase()) ||
    m.generic_name.toLowerCase().includes(search.toLowerCase()) ||
    m.brand_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!selected || !price) {
      setError("Select a medicine and enter a selling price.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/pharmacy/inventory", {
        method: "POST",
        body: { medicine: selected.id, selling_price: price },
      });
      window.location.href = "/pharmacy/inventory";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="pharmacy">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Add inventory item</h1>
        <p className="text-sm text-ink-secondary mb-8">Search the medicine catalogue and add to your inventory.</p>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        <Card className="mb-6">
          <Input
            label="Search medicine"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type generic or brand name"
          />
          {search && filtered.length > 0 && (
            <ul className="mt-2 divide-y divide-border border border-border rounded-lg max-h-60 overflow-y-auto bg-bg-elevated">
              {filtered.map((m) => (
                <li
                  key={m.id}
                  className={`px-4 py-3 tap-interactive hover:bg-accent/5 cursor-pointer ${selected?.id === m.id ? "bg-accent/10" : ""}`}
                  onClick={() => setSelected(m)}
                >
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-ink">{m.display_name}</span>
                    <span className="text-xs text-ink-secondary">{m.strength} · {m.dosage_form}</span>
                  </div>
                  <span className="text-xs text-ink-secondary">pack {m.pack_size} {m.pack_unit}</span>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <div className="mt-4 p-4 rounded border border-border bg-bg-elevated">
              <p className="font-medium text-ink">{selected.display_name}</p>
              <p className="text-xs text-ink-secondary">{selected.strength} · {selected.dosage_form} · pack {selected.pack_size} {selected.pack_unit}</p>
            </div>
          )}
        </Card>

        {selected && (
          <Card className="mb-6">
            <Input
              label="Selling price (₹)"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
            <Button onClick={handleAdd} loading={busy} disabled={busy} className="mt-4">
              Add to inventory
            </Button>
          </Card>
        )}
      </div>
    </Shell>
  );
}