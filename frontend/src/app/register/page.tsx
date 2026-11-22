"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  Activity,
  ArrowRight,
  Lock,
  Mail,
  User,
  AlertCircle,
  Stethoscope,
  Building2,
  UserCircle2,
  FileBadge,
  GraduationCap,
  MapPin,
} from "lucide-react";

interface RegisterResponse {
  id: number;
  email: string;
  active_role: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"patient" | "doctor" | "pharmacy">("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Doctor specific fields
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [clinicName, setClinicName] = useState("");

  // Pharmacy specific fields
  const [pharmacyName, setPharmacyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, string> = {
        email,
        password,
        role,
        full_name: fullName,
      };

      if (role === "doctor") {
        if (!registrationNumber.trim()) {
          setError("Medical Registration Number is required for doctors.");
          setLoading(false);
          return;
        }
        payload.registration_number = registrationNumber.trim();
        if (qualification.trim()) payload.qualification = qualification.trim();
        if (clinicName.trim()) payload.clinic_name = clinicName.trim();
      } else if (role === "pharmacy") {
        const storeName = pharmacyName.trim() || fullName.trim();
        if (!storeName) {
          setError("Pharmacy name is required.");
          setLoading(false);
          return;
        }
        payload.pharmacy_name = storeName;
        if (licenseNumber.trim()) payload.license_number = licenseNumber.trim();
        if (address.trim()) payload.address = address.trim();
        if (city.trim()) payload.city = city.trim();
      }

      const res = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: payload,
      });

      // The backend logs the user in upon registration.
      // Redirect to the appropriate portal or login:
      const portalMap: Record<string, string> = {
        patient: "/patient",
        doctor: "/doctor",
        pharmacy: "/pharmacy",
      };

      router.push(portalMap[res?.active_role || role] || "/login");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Registration failed. Please verify your details.");
      }
    } finally {
      setLoading(false);
    }
  }

  const roleOptions = [
    {
      id: "patient" as const,
      label: "Patient",
      desc: "Compare & fulfill prescriptions",
      icon: UserCircle2,
    },
    {
      id: "doctor" as const,
      label: "Doctor",
      desc: "Create digital prescriptions",
      icon: Stethoscope,
    },
    {
      id: "pharmacy" as const,
      label: "Pharmacy",
      desc: "Receive requests & quote prices",
      icon: Building2,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBFBFD] px-6 py-12 dark:bg-black font-sans selection:bg-blue-100 selection:text-blue-900">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/25">
          <Activity className="h-6 w-6 stroke-[2.2]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          MediRelay
        </span>
      </Link>

      <div className="w-full max-w-lg">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-xl border border-black/[0.06] dark:border-white/[0.08]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Create an account
            </h1>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Join the connected healthcare platform
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-red-50/80 p-3.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-900/40">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector Cards */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Select your primary role
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = role === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => {
                        setRole(opt.id);
                        setError("");
                      }}
                      className={`tap-interactive flex flex-col items-center justify-center rounded-2xl p-3 text-center border transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/80 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200 shadow-xs ring-1 ring-blue-600/20"
                          : "border-black/[0.06] bg-white/70 text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-zinc-900/60 dark:text-zinc-400"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 mb-1.5 ${
                          isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"
                        }`}
                      />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {role === "pharmacy" ? "Contact Person Name" : "Full Name"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={
                    role === "doctor"
                      ? "e.g. Dr. Sarah Jenkins"
                      : "e.g. Alex Morgan"
                  }
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                />
                <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              </div>
            </div>

            {/* Doctor-Specific Fields */}
            {role === "doctor" && (
              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Medical Registration Number <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-zinc-400 font-medium">State Council / NMC</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. MCI-2018-98432 or MH-54321"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                    />
                    <FileBadge className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Qualification (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. MBBS, MD"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Clinic / Hospital (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. City Care Hospital"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pharmacy-Specific Fields */}
            {role === "pharmacy" && (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Pharmacy / Store Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apollo Pharmacy #14"
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                    />
                    <Building2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-emerald-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Drug License No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DL-20B-12345"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Store Address (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shop 4, High Street, Bandra West"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                />
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2.5 pl-10 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900/60 dark:text-white dark:focus:bg-zinc-900"
                />
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tap-interactive mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 focus:outline-none disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Create {role.charAt(0).toUpperCase() + role.slice(1)} Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-black/[0.06] pt-6 text-center text-xs text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
