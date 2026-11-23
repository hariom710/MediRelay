"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Shell from "@/components/shell";

interface PharmacyProfile {
  id: number;
  pharmacy_name: string;
  address: string;
  city: string;
  pin_code: string;
  phone: string;
  opening_hours: string;
  contact_person: string;
  licence_number: string;
  verification_status: string;
  verification_note: string;
  default_pickup_fee: string;
  default_validity_days: number;
}

export default function PharmacyProfile() {
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<PharmacyProfile>("/pharmacy/profile").then(setProfile).catch(() => setError("Could not load profile."));
    api<Me>("/auth/me").then(setMe).catch(() => {});
  }, []);

  async function handleSave() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await api("/pharmacy/profile", {
        method: "PUT",
        body: {
          pharmacy_name: profile.pharmacy_name,
          address: profile.address,
          city: profile.city,
          pin_code: profile.pin_code,
          phone: profile.phone,
          opening_hours: profile.opening_hours,
          contact_person: profile.contact_person,
          default_pickup_fee: profile.default_pickup_fee,
          default_validity_days: profile.default_validity_days,
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
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Profile</h1>
        <p className="text-sm text-ink-secondary mb-8">Your pharmacy details</p>

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
              <h2 className="text-lg font-semibold text-ink mb-4">Pharmacy details</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <Input
                  label="Pharmacy name"
                  value={profile.pharmacy_name}
                  onChange={(e) => setProfile({ ...profile, pharmacy_name: e.target.value })}
                />
                <Input
                  label="Address"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="City"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  />
                  <Input
                    label="PIN code"
                    value={profile.pin_code}
                    onChange={(e) => setProfile({ ...profile, pin_code: e.target.value })}
                  />
                </div>
                <Input
                  label="Phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
                <Input
                  label="Opening hours"
                  value={profile.opening_hours}
                  onChange={(e) => setProfile({ ...profile, opening_hours: e.target.value })}
                />
                <Input
                  label="Contact person"
                  value={profile.contact_person}
                  onChange={(e) => setProfile({ ...profile, contact_person: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Default pickup fee"
                    value={profile.default_pickup_fee}
                    onChange={(e) => setProfile({ ...profile, default_pickup_fee: e.target.value })}
                  />
                  <Input
                    label="Default validity (days)"
                    type="number"
                    value={profile.default_validity_days}
                    onChange={(e) => setProfile({ ...profile, default_validity_days: Number(e.target.value) })}
                  />
                </div>
                <Button type="submit" loading={busy} disabled={busy}>Save</Button>
              </form>
              <p className="mt-3 text-xs text-ink-secondary">
                Verification:{" "}
                <Badge variant={profile.verification_status === "verified" ? "success" : "neutral"}>
                  {profile.verification_status.charAt(0).toUpperCase() + profile.verification_status.slice(1)}
                </Badge>
                {profile.verification_note && (
                  <span className="mt-1 block text-xs text-ink-secondary">Note: {profile.verification_note}</span>
                )}
              </p>
              {profile.licence_number && (
                <p className="mt-1 text-xs text-ink-secondary">Licence: {profile.licence_number}</p>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

