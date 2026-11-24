"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RxItem {
  id: number;
  medicine: number;
  medicine_name: string;
  strength: string;
  dosage_form: string;
  morning: number;
  afternoon: number;
  night: number;
  meal_timing: string;
  duration_days: number;
  total_qty: number;
  instructions: string;
}

interface ShareData {
  share_id: number;
  prescription_id: number;
  expires_at: string;
  prescription: {
    id: number;
    doctor_name?: string;
    patient_display?: string;
    patient_name?: string;
    age?: number | null;
    gender?: string;
    allergy_flag?: boolean;
    allergies?: string;
    consultation_date: string;
    valid_until?: string | null;
    is_expired?: boolean;
    status?: string;
    version: number;
    items: RxItem[];
  };
}

function ShareTokenContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    api<ShareData>(`/shares/${token}`)
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Invalid or expired share link.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--accent)] text-white font-bold text-xs">
            M
          </span>
          <span className="font-semibold tracking-tight text-sm text-[var(--text)]">
            MediRelay Shared Prescription
          </span>
        </Link>
        <Badge variant="finalized" size="sm">
          Cryptographically Signed
        </Badge>
      </div>

      {loading && (
        <Card className="p-12 text-center text-xs text-[var(--text-tertiary)]">
          Verifying share token…
        </Card>
      )}

      {error && (
        <Card className="p-8 text-center space-y-4 border-red-500/20 bg-red-50/50">
          <div className="text-red-600 font-semibold text-sm">Unable to View Prescription</div>
          <p className="text-xs text-red-500">{error}</p>
          <div>
            <Link href="/">
              <Button variant="secondary" size="sm" pill>Return to Home</Button>
            </Link>
          </div>
        </Card>
      )}

      {data && data.prescription && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">Prescription #{data.prescription.id}</h2>
                  <Badge variant="finalized" size="sm">v{data.prescription.version}</Badge>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Issued by {data.prescription.doctor_name || "your doctor"} • Consultation: {data.prescription.consultation_date}
                </p>
              </div>
              {data.prescription.allergy_flag && (
                <Badge variant="danger" size="sm">Allergy Alert</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--text-tertiary)]">Patient:</span>
                <p className="font-medium mt-0.5">{data.prescription.patient_display || data.prescription.patient_name || "Patient"} {data.prescription.age ? `(${data.prescription.age} yrs)` : ""}</p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Valid Until:</span>
                <p className="font-medium mt-0.5">{data.prescription.valid_until || "N/A"}</p>
              </div>
            </div>

            {data.prescription.allergies && (
              <div className="rounded-[var(--r-md)] bg-amber-500/10 p-3 text-xs text-amber-700">
                <span className="font-semibold">Recorded Allergies:</span> {data.prescription.allergies}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Prescribed Medications
              </h3>
              <div className="divide-y divide-[var(--border)]">
                {data.prescription.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-[var(--text)]">{item.medicine_name}</p>
                      <p className="text-[var(--text-secondary)] mt-0.5">
                        {item.dosage_form} • {item.strength} • {item.instructions}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-sm">Qty: {item.total_qty}</span>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{item.duration_days} days</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pharmacy Actions */}
            {me?.roles.includes("pharmacy") && (
              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3">
                <Button
                  size="md"
                  pill
                  onClick={() =>
                    router.push(
                      `/pharmacy/quotations/new?prescription_id=${data.prescription_id}&share_id=${data.share_id}`
                    )
                  }
                >
                  Submit Quotation
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ShareTokenPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-12 flex flex-col items-center">
      <Suspense fallback={<Card className="p-12 text-center text-xs text-[var(--text-tertiary)]">Loading...</Card>}>
        <ShareTokenContent params={params} />
      </Suspense>
    </div>
  );
}
