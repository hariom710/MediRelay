"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Shell from "@/components/shell";
import {
  type CareAccess,
  type AccessAuditLog,
  type PatientAccessCode,
} from "@/lib/types";

export default function PatientDoctorsAccessPage() {
  const [accessList, setAccessList] = useState<CareAccess[] | null>(null);
  const [logs, setLogs] = useState<AccessAuditLog[] | null>(null);
  const [activeCode, setActiveCode] = useState<PatientAccessCode | null>(null);
  const [codeScope, setCodeScope] = useState<"full" | "basic">("full");
  const [generatingCode, setGeneratingCode] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [grants, auditLogs] = await Promise.all([
        api<CareAccess[]>("/access"),
        api<AccessAuditLog[]>("/access/log"),
      ]);
      setAccessList(grants);
      setLogs(auditLogs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load access grants.");
    }
  }

  async function handleDecision(requestId: number, action: "approve" | "deny") {
    setProcessingId(requestId);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/access/requests/${requestId}/${action}`, { method: "POST" });
      setSuccessMsg(`Access request ${action === "approve" ? "approved" : "denied"}.`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} request.`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRevoke(accessId: number) {
    if (!window.confirm("Immediately revoke this doctor's access to your medical history?")) return;
    setProcessingId(accessId);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/access/${accessId}/revoke`, { method: "POST" });
      setSuccessMsg("Doctor access revoked.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke access.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleShortenExpiry(accessId: number, hours: number) {
    setProcessingId(accessId);
    setError("");
    setSuccessMsg("");
    try {
      const newExpiry = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      await api(`/access/${accessId}`, {
        method: "PATCH",
        body: { expires_at: newExpiry },
      });
      setSuccessMsg(`Access expiry shortened to ${hours} hour(s).`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to shorten expiry.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    setError("");
    try {
      const code = await api<PatientAccessCode>("/access/code", {
        method: "POST",
        body: { scope: codeScope, duration_minutes: 10 },
      });
      setActiveCode(code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate code.");
    } finally {
      setGeneratingCode(false);
    }
  }

  const pendingRequests = accessList?.filter((a) => a.status === "requested") || [];
  const activeDoctors = accessList?.filter((a) => a.status === "granted") || [];

  return (
    <Shell role="patient">
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
            My Doctors & Access Permissions
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Manage who can view your health records, approve incoming requests, and inspect audit logs.
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--r-md)] bg-[var(--danger-subtle)] p-4 text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-[var(--r-md)] bg-[var(--success-subtle)] p-4 text-xs font-medium text-[var(--success)] border border-[var(--success)]/20">
            {successMsg}
          </div>
        )}

        {/* In-Person Access Code Generator */}
        <Card className="p-6 space-y-4 border-2 border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Generate In-Person 6-Digit Code</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Provide this temporary code to your doctor during an in-clinic consultation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={codeScope}
                onChange={(e) => setCodeScope(e.target.value as "full" | "basic")}
                className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]"
              >
                <option value="full">Full Scope (Full Timeline)</option>
                <option value="basic">Basic Scope (Summary Only)</option>
              </select>
              <Button
                size="sm"
                onClick={handleGenerateCode}
                loading={generatingCode}
                disabled={generatingCode}
              >
                Generate Code
              </Button>
            </div>
          </div>

          {activeCode && (
            <div className="rounded-[var(--r-md)] border border-emerald-500/30 bg-[var(--bg-elevated)] p-4 text-center space-y-1 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                Single-Use Clinical Code
              </span>
              <div className="font-mono text-3xl font-black tracking-widest text-[var(--text)] py-1 select-all">
                {activeCode.code}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Valid for 10 minutes ({(activeCode.scope || "full").toUpperCase()} scope). The doctor will redeem it to access your record.
              </p>
            </div>
          )}
        </Card>

        {/* Section 1: Pending Access Requests */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[var(--text)]">
            Pending Access Requests ({pendingRequests.length})
          </h2>

          {pendingRequests.length === 0 ? (
            <Card className="p-6 text-center text-xs text-[var(--text-secondary)]">
              No pending doctor access requests.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {pendingRequests.map((req) => (
                <Card key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--text)]">{req.doctor_name}</span>
                      <Badge variant="warning" size="sm">
                        REQUESTED {(req.scope || "full").toUpperCase()} SCOPE
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Requested on {new Date(req.requested_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={processingId === req.id}
                      onClick={() => handleDecision(req.id, "deny")}
                    >
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      disabled={processingId === req.id}
                      loading={processingId === req.id}
                      onClick={() => handleDecision(req.id, "approve")}
                    >
                      Approve Access
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Active Doctors */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[var(--text)]">
            Active Doctors ({activeDoctors.length})
          </h2>

          {activeDoctors.length === 0 ? (
            <Card className="p-6 text-center text-xs text-[var(--text-secondary)]">
              No doctors currently have active access to your records.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {activeDoctors.map((doc) => {
                const expiresAt = new Date(doc.expires_at).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <Card key={doc.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text)]">{doc.doctor_name}</span>
                        <Badge variant="success" size="sm">
                          {(doc.scope || "full").toUpperCase()} SCOPE
                        </Badge>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
                          Via {doc.granted_via}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Valid until: <span className="font-medium text-[var(--text)]">{expiresAt}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={processingId === doc.id}
                        onClick={() => handleShortenExpiry(doc.id, 2)}
                      >
                        Shorten to 2h
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={processingId === doc.id}
                        loading={processingId === doc.id}
                        onClick={() => handleRevoke(doc.id)}
                      >
                        Revoke Access
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Access Audit Log */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Medical Record Access Audit Log</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Immutable record of every access, view, and authorization of your personal health data.
            </p>
          </div>

          {logs && logs.length === 0 ? (
            <Card className="p-6 text-center text-xs text-[var(--text-secondary)]">
              No audit logs recorded yet.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-[var(--border)]">
                {logs?.map((l) => (
                  <li key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text)]">{l.actor_name || l.actor_email || "System"}</span>
                        <Badge variant="neutral" size="sm">
                          {l.action}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 font-mono">
                        {new Date(l.timestamp).toLocaleString("en-GB")}
                      </p>
                    </div>

                    {l.metadata && Object.keys(l.metadata).length > 0 && (
                      <div className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-subtle)] px-2 py-1 rounded max-w-xs truncate">
                        {JSON.stringify(l.metadata)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
