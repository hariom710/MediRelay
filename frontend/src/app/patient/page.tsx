"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  ExternalLink,
  Receipt,
  Download,
} from "lucide-react";

interface Order {
  id: number;
  status: string;
  total: string;
  prescription: number;
  created_at: string;
  fulfillments: {
    id: number;
    pharmacy_name: string;
    status: string;
    subtotal: string;
    items: {
      medicine_name: string;
      qty: number;
      unit_price: string;
      line_total: string;
    }[];
  }[];
}

export default function PatientOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const res = await api<Order[]>("/orders/list");
      setOrders(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "placed":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
      case "partially_fulfilled":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
      case "cancelled":
        return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    }
  }

  return (
    <PortalShell role="patient">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            My Orders & Receipts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Track pharmacy order fulfillments, real-time stock reservations, and downloadable invoice PDFs.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="font-bold">✕</button>
        </div>
      )}

      {orders === null ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-xs text-zinc-400">
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            No orders placed yet
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Head to Prescriptions & Quotes to compare prices and fulfill your medicine orders.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-base text-zinc-900 dark:text-white">
                    ORD-{ord.id}
                  </span>
                  <span className="text-xs text-zinc-400">
                    from RX-{ord.prescription}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(
                      ord.status,
                    )}`}
                  >
                    {ord.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-400 mr-2">Total Amount:</span>
                  <span className="text-base font-bold text-zinc-900 dark:text-white">
                    ₹{ord.total}
                  </span>
                </div>
              </div>

              {/* Fulfillments list */}
              {ord.fulfillments && ord.fulfillments.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Pharmacy Fulfillments ({ord.fulfillments.length} branch{ord.fulfillments.length > 1 ? "es" : ""})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ord.fulfillments.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-2xl bg-zinc-50/80 p-4 dark:bg-zinc-900/60 border border-black/[0.04] dark:border-white/[0.06]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-purple-600" />
                            <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                              {f.pharmacy_name}
                            </span>
                          </div>
                          <span className="rounded bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {f.status}
                          </span>
                        </div>

                        <div className="space-y-1 mt-2 text-xs">
                          {f.items?.map((it, i) => (
                            <div key={i} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>{it.medicine_name} × {it.qty}</span>
                              <span>₹{it.line_total}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Subtotal: ₹{f.subtotal}</span>
                          <a
                            href={`/api/v1/invoices/${f.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tap-interactive inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-500"
                          >
                            <Download className="h-3 w-3" />
                            PDF Invoice
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
