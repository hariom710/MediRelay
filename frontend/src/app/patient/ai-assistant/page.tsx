"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  Sparkles,
  ScanText,
  FileSearch,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Clock,
  ExternalLink,
} from "lucide-react";

interface OCRResult {
  document_name: string;
  status: string;
  extracted_text: string;
  detected_items: {
    raw_line: string;
    matched_medicine_name: string;
    strength: string;
    dosage_form: string;
    morning: number;
    afternoon: number;
    night: number;
    duration_days: number;
    confidence: number;
  }[];
  confidence_overall: number;
  requires_human_verification: boolean;
}

interface ReportSummaryResult {
  report_title: string;
  analysis_summary: string;
  key_parameters: {
    name: string;
    value: string;
    normal_range: string;
    status: string;
  }[];
  questions_for_doctor: string[];
  disclaimer: string;
}

export default function AIAssistantPage() {
  const [activeTool, setActiveTool] = useState<"ocr" | "report_summary" | "interaction_check">("ocr");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [rawTextSample, setRawTextSample] = useState("");

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<ReportSummaryResult | null>(null);
  const [reportTitle, setReportTitle] = useState("Complete Blood Count (CBC)");

  const [error, setError] = useState("");

  async function handleRunOCR(e: React.FormEvent) {
    e.preventDefault();
    setOcrLoading(true);
    setError("");
    try {
      const res = await api<OCRResult>("/ai/ocr/extract", {
        method: "POST",
        body: { raw_text: rawTextSample },
      });
      setOcrResult(res);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSummarizeReport(e: React.FormEvent) {
    e.preventDefault();
    setSummaryLoading(true);
    setError("");
    try {
      const res = await api<ReportSummaryResult>("/ai/reports/summarize", {
        method: "POST",
        body: { title: reportTitle },
      });
      setSummaryResult(res);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <PortalShell role="patient">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              AI-Powered Healthcare Intelligence
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Intelligent prescription OCR extraction, structured dosage detection, and plain-language medical report analysis.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="font-bold">✕</button>
        </div>
      )}

      {/* Tool Navigation */}
      <div className="flex items-center gap-2 mb-8 border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
        {[
          { id: "ocr", label: "Prescription OCR Extractor", icon: ScanText },
          { id: "report_summary", label: "Medical Report Explainer", icon: FileSearch },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id as typeof activeTool)}
              className={`tap-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tool 1: Prescription OCR */}
      {activeTool === "ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-2">
                Scan or Paste Prescription Text
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                The optical recognition model detects handwriting lines, cross-references our master catalogue, and formats morning/afternoon/night schedules.
              </p>

              <form onSubmit={handleRunOCR} className="space-y-4">
                <textarea
                  rows={6}
                  placeholder="Paste OCR text or let AI evaluate sample prescription (e.g. Paracetamol 500mg tid, Amoxicillin 500mg bid)…"
                  value={rawTextSample}
                  onChange={(e) => setRawTextSample(e.target.value)}
                  className="w-full rounded-2xl border border-black/[0.08] bg-white p-3 text-xs text-zinc-800 shadow-xs dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
                />

                <button
                  type="submit"
                  disabled={ocrLoading}
                  className="tap-interactive flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {ocrLoading ? "Extracting Text & Catalog Matches…" : "Run AI OCR Analysis"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            {ocrResult ? (
              <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Structured Prescription Extraction</h4>
                    <span className="text-[11px] text-zinc-400">Overall Model Confidence: {(ocrResult.confidence_overall * 100).toFixed(0)}%</span>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    Verification Required
                  </span>
                </div>

                <div className="space-y-3">
                  {ocrResult.detected_items.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-black/[0.04] bg-zinc-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">
                          {it.matched_medicine_name}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                          {(it.confidence * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">Original: &ldquo;{it.raw_line}&rdquo;</p>

                      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Schedule: <strong>{it.morning}-{it.afternoon}-{it.night}</strong></span>
                        <span>·</span>
                        <span>Duration: <strong>{it.duration_days} days</strong></span>
                        <span>·</span>
                        <span>Form: {it.dosage_form} ({it.strength})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-3xl p-12 text-center text-xs text-zinc-400">
                Click &ldquo;Run AI OCR Analysis&rdquo; to process prescription images or digital transcriptions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tool 2: Medical Report Summarizer */}
      {activeTool === "report_summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-2">
                Plain-Language Report Explainer
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Transforms complex pathological reports, clinical reference ranges, and lab markers into easily understood guidance.
              </p>

              <form onSubmit={handleSummarizeReport} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Report Category</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={summaryLoading}
                  className="tap-interactive flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-500/20 hover:bg-purple-500 disabled:opacity-50"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  {summaryLoading ? "Analyzing Clinical Parameters…" : "Generate Plain-Language Summary"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            {summaryResult ? (
              <div className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08] space-y-5">
                <div>
                  <h4 className="font-bold text-base text-zinc-900 dark:text-white">{summaryResult.report_title}</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mt-2 bg-purple-50/60 p-4 rounded-2xl dark:bg-purple-950/20 border border-purple-200/50">
                    {summaryResult.analysis_summary}
                  </p>
                </div>

                {/* Key parameters table */}
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Key Biomarkers</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {summaryResult.key_parameters.map((p, idx) => (
                      <div key={idx} className="rounded-xl bg-zinc-50/80 p-3 text-xs dark:bg-zinc-900/60 border border-black/[0.04]">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{p.name}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            p.status === "normal" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {p.status === "normal" ? "Optimal" : "Slightly High"}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{p.value}</p>
                        <p className="text-[10px] text-zinc-400">Normal range: {p.normal_range}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-100/70 p-3 text-[11px] text-zinc-500 dark:bg-zinc-900/50">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">Questions to ask your doctor:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {summaryResult.questions_for_doctor.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-zinc-400 italic">{summaryResult.disclaimer}</p>
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-3xl p-12 text-center text-xs text-zinc-400">
                Submit a report category on the left to view structured biomarker breakdowns and plain-language summaries.
              </div>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}
