"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Shell from "@/components/shell";

interface DoctorProfile {
  id: number;
  qualification: string;
  registration_number: string;
  clinic_name: string;
  verification_status: string;
  verification_note: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<DoctorProfile>("/doctor/profile").then(setProfile).catch(() => setError("Could not load profile."));
    api<Me>("/auth/me").then(setMe).catch(() => {});
  }, []);

  async function handleSave() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await api("/doctor/profile", {
        method: "PUT",
        body: {
          qualification: profile.qualification,
          registration_number: profile.registration_number,
          clinic_name: profile.clinic_name,
        },
      });
      window.alert("Profile saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  if (profile === null && !error) {
    return (
      <Shell role="doctor">
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-8 w-8 rounded border-border" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role="doctor">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Profile</h1>
        <p className="text-sm text-ink-secondary mb-8">Your account details</p>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
          </Card>
        )}

        {profile && (
          <>
            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Account</h2>
              <dl className="divide-y divide-border space-y-0">
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Email</dt>
                  <dd className="text-sm text-ink">{me?.email}</dd>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Active role</dt>
                  <dd className="text-sm text-ink">{me?.active_role}</dd>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <dt className="text-sm text-ink-secondary">Roles</dt>
                  <dd className="text-sm text-ink">{me?.roles.join(", ")}</dd>
                </div>
              </dl>
            </Card>

            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Doctor details</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <Input
                  label="Qualification"
                  value={profile.qualification}
                  onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                />
                <Input
                  label="Registration number (read-only once verified)"
                  value={profile.registration_number}
                  onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })}
                  disabled={profile.verification_status === "verified"}
                />
                <Input
                  label="Clinic name"
                  value={profile.clinic_name}
                  onChange={(e) => setProfile({ ...profile, clinic_name: e.target.value })}
                />
                <Button type="submit" loading={busy} disabled={busy}>Save</Button>
              </form>
              <p className="mt-3 text-xs text-ink-secondary">
                Verification:{" "}
                <Badge variant={profile.verification_status === "verified" ? "success" : "neutral"}>
                  {profile.verification_status.charAt(0).toUpperCase() + profile.verification_status.slice(1)}
                </Badge>
                {profile.verification_note && (
                  <p className="mt-1 text-xs text-ink-secondary">Note: {profile.verification_note}</p>
                )}
              </p>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

