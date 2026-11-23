# Doctor Portal Audit — MediRelay

**Branch:** `doctor-portal` (created from `security-hardening`)
**Date:** 23 Nov 2026
**Product:** MediRelay — prescription-to-pharmacy marketplace for India
**Auditor:** Phase 0 Recon → Phase 1 Feature Audit

---

## Recon findings (Phase 0)

### Git state
- Working tree was dirty (apple-inspired frontend shell). Committed as `30afd51` on `security-hardening`.
- New branch `doctor-portal` created at `30afd51`.

### Existing doctor-related frontend routes/components
| Route | File | Notes |
|-------|------|-------|
| `/` | `frontend/src/app/page.tsx` | Landing page (glass, gradients — violates new design rules) |
| `/login` | `frontend/src/app/login/page.tsx` | Uses `lucide-react` icons (to be removed per rules) |
| `/register` | `frontend/src/app/register/page.tsx` | Role-aware; uses `lucide-react` |
| `/doctor` | `frontend/src/app/doctor/page.tsx` | Patients list only; glass shell |
| `/doctor/patients` | MISSING | No route |
| `/doctor/patients/[id]` | MISSING | No route |
| `/doctor/prescriptions/new` | MISSING | No studio |
| `/doctor/prescriptions` | MISSING | No list |
| `/doctor/prescriptions/[id]` | MISSING | No detail |
| `/doctor/notifications` | MISSING | No route |
| `/doctor/profile` | MISSING | No route |

### Shared components
`frontend/src/components/ui/` — `button`, `input`, `card`, `badge`, `cn` util.
`frontend/src/components/shell.tsx` — glass sidebar + role guard (violates: glass, blur, lucide icons, emoji).
`frontend/src/lib/api.ts` — session + CSRF API client (reusable, correct).
`frontend/src/app/globals.css` — apple-inspired tokens (glass, gradients, dark mode — all to be removed per new design rules).

### Existing doctor-related backend endpoints
| Endpoint | Method | File | Status |
|----------|--------|------|--------|
| `/api/v1/auth/register` | POST | `accounts.views.RegisterView` | Exists |
| `/api/v1/auth/login` | POST | `accounts.views.LoginView` | Exists |
| `/api/v1/auth/logout` | POST | `accounts.views.LogoutView` | Exists |
| `/api/v1/auth/me` | GET | `accounts.views.MeView` | Exists |
| `/api/v1/auth/switch-role` | POST | `accounts.views.SwitchRoleView` | Exists |
| `/api/v1/doctor/profile` | GET/PUT | `accounts.views.DoctorProfileView` | Exists |
| `/api/v1/patients` | GET/POST | `accounts.patient_views.PatientListCreateView` | Exists (search, no pagination) |
| `/api/v1/patients/<pk>` | GET/DELETE | `accounts.patient_views.PatientDetailView` | Exists (delete → 409 if prescriptions) |
| `/api/v1/medicines/search` | GET | `catalog.views.MedicineSearchView` | Exists |
| `/api/v1/medicines/<pk>` | GET/DELETE | `catalog.views.MedicineDetailView` | Exists |
| `/api/v1/prescriptions` | GET/POST | `prescriptions.views.PrescriptionListCreateView` | Exists (doctor-only, own data) |
| `/api/v1/prescriptions/<pk>` | GET/PATCH | `prescriptions.views.PrescriptionDetailView` | Exists |
| `/api/v1/prescriptions/<pk>/finalize` | POST | `prescriptions.views.PrescriptionFinalizeView` | Exists (no verification check) |
| `/api/v1/prescriptions/<pk>/revise` | POST | `prescriptions.views.PrescriptionReviseView` | Exists |
| `/api/v1/prescriptions/<pk>/cancel` | POST | `prescriptions.views.PrescriptionCancelView` | Exists |
| `/api/v1/prescriptions/<pk>/pdf` | GET | `prescriptions.views.PrescriptionPDFView` | Exists |
| `/api/v1/prescriptions/<pk>/shares` | GET/POST | `prescriptions.views.ShareListCreateView` | Exists (no verification check) |
| `/api/v1/prescriptions/<pk>/shares/<share_id>/revoke` | POST | `prescriptions.views.ShareRevokeView` | Exists |
| `/api/v1/shares/<token>` | GET | `prescriptions.views.ShareTokenView` | Exists |
| `/api/v1/notifications` | GET | `notifications.views.NotificationListView` | Exists |
| `/api/v1/notifications/<pk>/read` | POST | `notifications.views.NotificationReadView` | Exists |
| `/api/v1/notifications/read-all` | POST | `notifications.views.NotificationReadAllView` | Exists |

### Backend gaps identified
1. **No verification check on `finalize`/`share`** — unverified/rejected/suspended doctors can finalize and share (D0.2, D5.6, D9.2).
2. **No patient edit endpoint** — only GET/DELETE on patients/<pk> (D2.3).
3. **No change-password endpoint** (D7.3).
4. **No access-log list endpoint** for the doctor portal (D5.5 — logs exist but only admin can list them).

### Frontend issues (design rules violations)
- `globals.css`: glassmorphism, gradients, dark mode, blur — all forbidden by new rules.
- `shell.tsx`: glass sidebar, blur, `lucide-react` icons (`LogOut`, `ChevronRight`), emoji in nav.
- `login.tsx`, `register.tsx`: `lucide-react` icons.
- No design tokens defined per the new flat/clinical system.

---

## Phase 1 — Feature audit

Status key: DONE | PARTIAL | STUB | MISSING | NEEDS BACKEND | OUT OF SCOPE

### D0 — Shell and access

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D0.1 | Doctor-only route guard; expired session → login | PARTIAL | `shell.tsx` checks `active_role`; `/doctor` page uses `<Shell role="doctor">` | No per-route guard; no redirect-back-after-login; expired session (401) not handled |
| D0.2 | Verification banner (pending/under_review/rejected/suspended); finalize+share disabled with reason | MISSING | No verification UI anywhere in doctor portal | Backend also doesn't block finalize/share for unverified doctors (NEEDS BACKEND) |
| D0.3 | Navigation: Dashboard, Patients, New prescription, Prescriptions, Notifications (unread count), Profile | PARTIAL | `shell.tsx` doctor nav has only Patients + Prescriptions | Missing Dashboard, Notifications count, Profile |
| D0.4 | Role switcher + logout | DONE | `shell.tsx` switcher + logout button | None |
| D0.5 | Page header, breadcrumbs, current-user label | PARTIAL | `shell.tsx` shows email; no breadcrumbs; no page header component | No breadcrumbs, no consistent header |

### D1 — Dashboard

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D1.1 | Counts: drafts, finalized-not-shared, active shares, expiring in 7 days | MISSING | No dashboard route/backend aggregation | NEEDS BACKEND (aggregation endpoint) |
| D1.2 | Recent prescriptions and recent patients (links) | PARTIAL | Patients list exists at `/doctor` | No prescriptions list; no links |
| D1.3 | Quick actions: new patient, new prescription | MISSING | "New prescription" button exists on patients page | Not on dashboard; no new patient action |
| D1.4 | Empty state for brand-new doctor | MISSING | No dashboard | Entire dashboard missing |

### D2 — Patients

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D2.1 | List own patients, search (name), pagination | PARTIAL | `PatientListCreateView` GET with `q` search; `[:100]` slice | No real pagination (page params); UI only on `/doctor`, not `/doctor/patients` |
| D2.2 | Create patient: name, dob/age, sex, phone, blood group, allergies; validation + duplicate warning | PARTIAL | `PatientListCreateView` POST: name, dob, gender, allergies | Missing age, phone, blood group; no duplicate warning; UI missing |
| D2.3 | Edit patient; allergies as add/remove entries | MISSING | No PUT/PATCH on patients/<pk> | NEEDS BACKEND + UI |
| D2.4 | Patient detail: demographics, allergies, prescription history, "New prescription" | PARTIAL | `PatientDetailView` GET returns demographics + allergies | No prescription history; no "New prescription" action; UI missing |
| D2.5 | Delete blocked with 409 when patient has prescriptions | DONE | `PatientDetailView.delete` returns 409 `patient_has_prescriptions` | UI doesn't surface this |

### D3 — Prescription studio

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D3.1 | Select patient (search or preselected); show allergies prominently | PARTIAL | Patient search exists in backend | Studio UI missing; allergy alert missing |
| D3.2 | Consultation date; validity date (default 30, max 180) | PARTIAL | Backend `PrescriptionListCreateView` accepts `valid_until` (max 180) | Default 30 days not set; UI missing |
| D3.3 | Medicine search by generic/brand + strength/form/pack; debounced; keyboard-nav | PARTIAL | `MedicineSearchView` exists | UI missing (search, debounce, keyboard nav) |
| D3.4 | Structured dosage: morning/afternoon/night, meal timing, duration, instructions | PARTIAL | `ItemWriteSerializer` + `PrescriptionItem` model support all fields | UI missing |
| D3.5 | Total qty computed live; form rules (tablets/capsules schedule; liquids/packs direct); pack rounding | PARTIAL | `computed_total()` in `prescriptions.services` | UI missing (live computation, pack rounding display) |
| D3.6 | Doctor must confirm `confirmed_qty`; server rejects mismatch | PARTIAL | `PrescriptionFinalizeView` enforces confirmation + match | UI missing |
| D3.7 | Allergy alert; acknowledge with reason | MISSING | `PatientProfile.allergies` exists; `PharmacyRxSerializer.allergy_flag` | No alert logic in backend or UI |
| D3.8 | Duplicate medicine warning (and active ingredient) | MISSING | None | UI missing |
| D3.9 | Add/edit/reorder/remove items; ≥1 item; max | PARTIAL | Backend PATCH replaces all items while draft | UI missing |
| D3.10 | Save draft (explicit + warn on unsaved); resume draft | PARTIAL | Backend creates DRAFT prescriptions | UI missing (draft list, resume, unsaved-changes warning) |
| D3.11 | Preview screen (redacted pharmacy view + patient view) | MISSING | `PharmacyRxSerializer` exists (pharmacy scoped view) | UI missing |
| D3.12 | Finalize confirmation (immutable); double-click protection; readable server errors | PARTIAL | Backend finalize enforces qty confirmation + immutability | UI missing (confirmation dialog, double-click protection) |
| D3.13 | After finalize: download PDF, share | MISSING | Backend PDF + shares exist | UI missing |

### D4 — Prescription list and detail

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D4.1 | List own prescriptions: status badge, patient, date, version, validity; filters/search/pagination | PARTIAL | `PrescriptionListCreateView` GET (doctor-only, status filter) | No filters for patient/date-range; no pagination UI; UI missing |
| D4.2 | Detail: all items, dosage, confirmed qty, status, version, signed time, validity | PARTIAL | `PrescriptionDetailView` GET + `PrescriptionSerializer` | UI missing |
| D4.3 | Finalized + older versions read-only everywhere | PARTIAL | Backend rejects PATCH on non-draft (409 `not_draft`) | UI must enforce too |
| D4.4 | Revise: reason required; new version; previous stays viewable/marked superseded | PARTIAL | `PrescriptionReviseView` exists (reason required, version chain) | UI missing |
| D4.5 | Version history chain with dates and reasons | PARTIAL | `previous_version` FK on model | UI missing |
| D4.6 | Cancel with reason + confirmation; cancelled cannot be shared | PARTIAL | `PrescriptionCancelView` exists; shares require FINALIZED | UI missing |
| D4.7 | PDF download via authorized endpoint | PARTIAL | `PrescriptionPDFView` exists | UI missing |
| D4.8 | Expired state shown; expired cannot be shared/revised | PARTIAL | `Prescription.is_expired` property; share requires FINALIZED | UI missing |

### D5 — Sharing

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D5.1 | Create share: specific verified pharmacy or open link; expiry choice (default, max) | PARTIAL | `ShareListCreateView` POST (pharmacy_id optional; days 1-30, default 7) | UI missing |
| D5.2 | Link shown once + copy + local QR code | PARTIAL | Backend returns plaintext `token` once (hash stored) | QR code generation missing (NEEDS BACKEND: `qrcode` package justification) |
| D5.3 | Share list per prescription: status, target, created, expiry, access count, last access | PARTIAL | `ShareListCreateView` GET + `ShareSerializer` | Access count/last access not in serializer; UI missing |
| D5.4 | Revoke with confirmation; status updates immediately | PARTIAL | `ShareRevokeView` POST | UI missing |
| D5.5 | Access log: which pharmacy opened + when | PARTIAL | `PrescriptionAccessLog` model logs every open | No doctor-facing endpoint (admin only lists audit logs); NEEDS BACKEND |
| D5.6 | Share/finalize blocked for unverified doctors | MISSING | Backend does NOT check `verification_status` on finalize/share | NEEDS BACKEND |

### D6 — Notifications

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D6.1 | List with unread indicator; mark one read; mark all read | PARTIAL | `NotificationListView` (unread count + list), `NotificationReadView`, `NotificationReadAllView` | UI missing |
| D6.2 | Unread count in navigation | MISSING | Backend returns `unread` | UI missing |

### D7 — Profile

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D7.1 | View/edit name, qualification, clinic, phone; registration number read-only once verified | PARTIAL | `DoctorProfileView` GET/PUT (all fields writable incl. reg number) | UI missing; reg-number-read-only-once-verified not enforced |
| D7.2 | Verification status + rejection reason | PARTIAL | `DoctorProfileSerializer` returns `verification_status`, `verification_note` | UI missing |
| D7.3 | Change password | NEEDS BACKEND | No password-change endpoint | NEEDS BACKEND |

### D8 — Cross-cutting quality

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D8.1 | Design tokens + shared components; flat clinical rules | MISSING | Current tokens are glass/gradient/dark-mode (forbidden) | Entire design system must be rewritten |
| D8.2 | Responsive from 360px; studio usable on phone | PARTIAL | Some responsive classes | Not systematic; studio missing |
| D8.3 | Accessibility: labels, focus, keyboard, contrast, colour-not-only | PARTIAL | `Input` has labels | No focus-visible system; studio missing |
| D8.4 | Date/number formats (DD MMM YYYY, Indian time); no raw ISO | MISSING | Backend returns ISO strings | UI formats raw ISO |
| D8.5 | Destructive confirmed; loading states; double-submit protection; readable errors + retry | MISSING | `Button` has loading prop | No confirm dialogs; no retry; no double-submit |
| D8.6 | No console errors; no `lucide-react`/icon library | MISSING | `lucide-react` used in login, register, shell | Must remove icon library |

### D9 — Security and privacy

| ID | Feature | Status | Evidence | Gap |
|----|---------|--------|----------|-----|
| D9.1 | Another doctor's patients/prescriptions/shares/PDFs not reachable | PARTIAL | Backend scopes by doctor; `_can_view` | UI not tested; API partially tested |
| D9.2 | Unverified/rejected/suspended cannot finalize or share | MISSING | Backend does NOT check verification on finalize/share | NEEDS BACKEND |
| D9.3 | Finalized + old versions reject edits at API | DONE | `PrescriptionDetailView.patch` returns 409 `not_draft` | None |
| D9.4 | Share plaintext not in browser storage/console/audit | PARTIAL | Backend returns token once, stores hash | UI must not store token |
| D9.5 | No patient identifiers in URLs; no external hosts | DONE | Backend uses IDs only; no external hosts | None |

---

### Summary counts

| Status | Count |
|--------|-------|
| DONE | 5 (D0.4, D2.5, D9.3, D9.5 + finalize immutability) |
| PARTIAL | ~34 |
| MISSING | ~18 |
| NEEDS BACKEND | 6 (verification block on finalize/share, patient edit, change password, access-log endpoint, dashboard aggregation, QR package) |
| OUT OF SCOPE | Tier C items (not in doctor portal) |

### Backend endpoints to add or change

| # | Endpoint | Change | Request shape | Response shape |
|---|----------|--------|---------------|----------------|
| E1 | `POST /api/v1/prescriptions/<pk>/finalize` | CHANGE — block unless `verification_status == verified` | `{items: [{item_id, confirmed_qty}]}` | `PrescriptionSerializer` data or 403/409 |
| E2 | `POST /api/v1/prescriptions/<pk>/shares` | CHANGE — block unless doctor verified | `{pharmacy_id?, expires_in_days?}` | `{share, token}` or 403 |
| E3 | `PUT/PATCH /api/v1/patients/<pk>` | ADD — edit patient | `{name, date_of_birth, gender, blood_group, phone, allergies}` | `PatientProfileSerializer` data |
| E4 | `POST /api/v1/auth/change-password` | ADD — change password | `{old_password, new_password}` | `{detail}` |
| E5 | `GET /api/v1/prescriptions/<pk>/access-logs` | ADD — doctor access log for a prescription | none | `[{user, role, accessed_at}]` |
| E6 | `GET /api/v1/doctor/dashboard` | ADD — aggregation counts | none | `{drafts, finalized_not_shared, active_shares, expiring_soon, recent_prescriptions, recent_patients}` |

### Slice plan

- **Slice 1:** Design system rewrite (flat tokens), shared components, shell/route guard, verification banner, patients list/create/edit/detail.
- **Slice 2:** Prescription studio (D3), draft save/resume, preview, finalize.
- **Slice 3:** Prescription list/detail, version history, revise, cancel, PDF.
- **Slice 4:** Sharing (D5), QR, share list, revoke, access log.
- **Slice 5:** Dashboard (D1), notifications (D6), profile (D7).
- **Slice 6:** Tier B (templates, re-issue, etc.) if feasible.

---

**Stopping here for approval.** The audit report is saved as `docs/DOCTOR_PORTAL_AUDIT.md` (this file). Backend baseline: 135 passed. Frontend: tsc clean, build clean, lint 5 errors/9 warnings.

Next, on approval, I'll proceed to Phase 2 (backend gaps E1–E6), writing failing tests first for security-relevant behaviour.