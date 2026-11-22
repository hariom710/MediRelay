"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PortalShell from "@/components/portal-shell";
import {
  FlaskConical,
  Search,
  Calendar,
  Clock,
  Home,
  Building,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Download,
} from "lucide-react";

interface DiagnosticTest {
  id: number;
  laboratory: number;
  laboratory_name: string;
  city: string;
  offers_home_collection: boolean;
  test_name: string;
  test_code: string;
  description: string;
  price: string;
  turnaround_hours: number;
  is_available: boolean;
}

interface LabBooking {
  id: number;
  test: number;
  test_details: DiagnosticTest;
  scheduled_date: string;
  scheduled_time: string;
  home_collection: boolean;
  address: string;
  status: string;
  report_file_url: string;
  report_summary: string;
  created_at: string;
}

export default function DiagnosticLabsPage() {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [bookings, setBookings] = useState<LabBooking[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "my_bookings">("catalog");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Booking Modal
  const [bookingTest, setBookingTest] = useState<DiagnosticTest | null>(null);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("Morning (08:00 AM - 11:00 AM)");
  const [isHomeCollection, setIsHomeCollection] = useState(true);
  const [collectionAddress, setCollectionAddress] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
    loadBookings();
    setBookDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  }, []);

  async function loadCatalog(q = "", city = "") {
    setLoading(true);
    try {
      const res = await api<DiagnosticTest[]>(
        `/labs/tests?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`,
      );
      setTests(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings() {
    try {
      const res = await api<LabBooking[]>("/labs/bookings");
      setBookings(res);
    } catch {
      // ignore
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadCatalog(searchQuery, selectedCity);
  }

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingTest) return;
    setBookingLoading(true);
    setError("");

    try {
      await api("/labs/bookings", {
        method: "POST",
        body: {
          test: bookingTest.id,
          scheduled_date: bookDate,
          scheduled_time: bookTime,
          home_collection: isHomeCollection,
          address: isHomeCollection ? collectionAddress : "Visiting Laboratory Centre",
        },
      });

      setSuccessMsg(`Appointment for ${bookingTest.test_name} booked successfully!`);
      setBookingTest(null);
      setActiveTab("my_bookings");
      loadBookings();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to book test.");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <PortalShell role="patient">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Diagnostic Laboratories & Tests
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Compare verified clinical laboratory test prices, book home sample collections, and access reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`tap-interactive rounded-xl px-4 py-2 text-xs font-semibold ${
              activeTab === "catalog"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            Find Tests & Prices
          </button>
          <button
            onClick={() => setActiveTab("my_bookings")}
            className={`tap-interactive rounded-xl px-4 py-2 text-xs font-semibold ${
              activeTab === "my_bookings"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            My Appointments ({bookings?.length || 0})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="font-bold">✕</button>
        </div>
      )}

      {/* Tab 1: Catalogue & Search */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search diagnostic tests (e.g. CBC, Lipid Profile, Thyroid TSH, HbA1c)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-2.5 pl-10 text-xs text-zinc-900 shadow-xs focus:border-blue-500 focus:outline-none dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white"
              />
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            </div>

            <button
              type="submit"
              className="tap-interactive shrink-0 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500"
            >
              Search Labs
            </button>
          </form>

          {/* Test Cards Grid */}
          {loading ? (
            <p className="p-8 text-xs text-zinc-400 text-center">Comparing diagnostic laboratory prices…</p>
          ) : tests.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <FlaskConical className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No diagnostic tests listed</p>
              <p className="text-xs text-zinc-400 mt-1">Try another search term or view all laboratory packages.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map((t) => (
                <div
                  key={t.id}
                  className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between hover:shadow-lg transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5" />
                        {t.laboratory_name}
                      </span>
                      {t.offers_home_collection && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
                          <Home className="h-3 w-3" /> Home Collection
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-zinc-900 dark:text-white mt-1">
                      {t.test_name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                      {t.description || "Routine diagnostic evaluation with calibrated accuracy."}
                    </p>

                    <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {t.turnaround_hours}h Report
                      </span>
                      <span>·</span>
                      <span>City: {t.city || "All Local Areas"}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Price</span>
                      <span className="text-lg font-bold text-zinc-900 dark:text-white">₹{t.price}</span>
                    </div>

                    <button
                      onClick={() => setBookingTest(t)}
                      className="tap-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500"
                    >
                      Book Test
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Bookings */}
      {activeTab === "my_bookings" && (
        <div className="space-y-4">
          {bookings === null ? (
            <p className="p-8 text-xs text-zinc-400 text-center">Loading appointments…</p>
          ) : bookings.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <Calendar className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No scheduled lab tests</p>
              <p className="text-xs text-zinc-400 mt-1">Book diagnostic tests from verified pathology laboratories.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="glass-panel rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-zinc-900 dark:text-white">
                          {b.test_details?.test_name || "Diagnostic Test"}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 uppercase">
                          {b.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Lab: <strong>{b.test_details?.laboratory_name}</strong> · Scheduled for {b.scheduled_date} ({b.scheduled_time})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">₹{b.test_details?.price}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
                    <span>Collection Mode: {b.home_collection ? `Home Collection (${b.address})` : "Lab Visit"}</span>
                    {b.status === "report_ready" ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <FileCheck className="h-4 w-4" /> Report Uploaded & Verified
                      </span>
                    ) : (
                      <span className="text-zinc-400">Sample processing in progress</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {bookingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.1]">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Schedule {bookingTest.test_name}
                </h3>
                <p className="text-xs text-zinc-400">{bookingTest.laboratory_name}</p>
              </div>
              <button onClick={() => setBookingTest(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmBooking} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Time Slot</label>
                  <select
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-2.5 py-2 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                  >
                    <option value="Morning (07:00 AM - 09:00 AM)">Fasting (07:00 AM - 09:00 AM)</option>
                    <option value="Morning (09:00 AM - 11:00 AM)">Morning (09:00 AM - 11:00 AM)</option>
                    <option value="Afternoon (01:00 PM - 03:00 PM)">Afternoon (01:00 PM - 03:00 PM)</option>
                  </select>
                </div>
              </div>

              {bookingTest.offers_home_collection && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium mb-2">
                    <input
                      type="checkbox"
                      checked={isHomeCollection}
                      onChange={(e) => setIsHomeCollection(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Request Phlebotomist for Home Sample Collection</span>
                  </label>

                  {isHomeCollection && (
                    <textarea
                      required
                      rows={2}
                      placeholder="Enter full home address for sample collection…"
                      value={collectionAddress}
                      onChange={(e) => setCollectionAddress(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] bg-white p-3 text-xs dark:border-white/[0.1] dark:bg-zinc-900"
                    />
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-zinc-50 p-3 text-xs dark:bg-zinc-900 flex justify-between">
                <span>Total Payable Amount</span>
                <span className="font-bold text-zinc-900 dark:text-white">₹{bookingTest.price}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingTest(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50"
                >
                  {bookingLoading ? "Confirming…" : "Confirm Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
