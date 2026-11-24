# Universal Patient Registry — Design

Status: **design only, awaiting approval.** No implementation yet.
Branch: `universal-patient`

---

## A. Audit — everything that assumes a doctor owns a patient

### Root cause

`PatientProfile` already has global identity (`OneToOneField(User)`), so the
*data* is not per-doctor. What is per-doctor is **visibility and authorization**:

- `accounts/models.py:152-153` — `PatientProfile.created_by` (FK to the creating
  doctor's `User`) is used as the ownership key everywhere.
- `accounts/patient_views.py:23-26` — the doctor's patient list is
  `created_by=me OR prescriptions.doctor=me`, so doctor B cannot find a patient
  doctor A created. Doctor B therefore creates a **second** `PatientProfile`
  (with a throwaway placeholder user), which is the duplication reported.
- `accounts/patient_views.py:28-30` — that list searches with `icontains` on
  name/email, i.e. partial-name browsing of *their own* records only.

### Second, independent bug found during the audit

`accounts/patient_views.py:58-64` creates the doctor-created patient with
`password=secrets.token_urlsafe(24)` and returns only `placeholder_email`. The
password is discarded and never shown, so **a doctor-created patient can never
log in** and can never see their own record. The `has_account` flag at
`accounts/patient_views.py:37` is derived from the `@medirelay.local` suffix.

### Third: a live authorization hole

`prescriptions/views.py:82-86` loads any `PatientProfile` by id **without any
ownership or consent check**. Any authenticated doctor can create a
prescription for any patient id in the database. The old "doctor sees only
their own patients" rule is enforced on `/patients/*` but not here. Effective
privacy today relies on doctors not guessing ids.

### Models

| Location | What assumes doctor ownership |
|---|---|
| `accounts/models.py:146-153` | `PatientProfile.created_by` — the ownership field |
| `accounts/models.py:147` | `user` OneToOne — identity is already global, keep |
| `prescriptions/models.py:25-26` | `Prescription.patient` FK — stays, semantics change |
| `orders/models.py:29-30` | `Order.patient` FK — stays |
| `quotations/models.py` | no direct patient FK (goes via prescription) — unchanged |
| `notifications/models.py:11-20` | generic notification, reusable for access requests |

### Serializers

| Location | Issue |
|---|---|
| `accounts/serializers.py:83-86` | one `PatientProfileSerializer` serves both doctor and patient views; needs a masked doctor variant and a full self variant |
| `accounts/serializers.py:7-37` | `RegisterSerializer` — no claim detection for matching an unclaimed doctor-created profile |
| `prescriptions/serializers.py:51-69` | `PrescriptionSerializer` exposes `notes` and full patient name to any caller of `_can_view` |
| `prescriptions/serializers.py:72-113` | `PharmacyRxSerializer` — redaction rules must not change |

### Views / endpoints

| Location | Issue |
|---|---|
| `accounts/patient_views.py:15-39` | `GET /api/v1/patients` — own-patients filter + partial-name search |
| `accounts/patient_views.py:41-74` | `POST /api/v1/patients` — no dedupe, unusable credentials (see above) |
| `accounts/patient_views.py:77-91` | `GET /patients/<pk>` — `created_by` / prescribed-to gate |
| `accounts/patient_views.py:93-113` | `DELETE /patients/<pk>` — same gate |
| `accounts/patient_views.py:115-157` | `PATCH /patients/<pk>` — same gate |
| `accounts/views.py:51-52` | self-registration always creates a fresh profile, never claims |
| `accounts/views.py:177-187` | `PatientProfileView` — self-service GET/PUT, reusable |
| `accounts/views.py:244-279` | `DoctorDashboardView.recent_patients` derived from own prescriptions |
| `prescriptions/views.py:25-51` | `_can_view` — doctor only if `rx.doctor_id == own`; no cross-doctor access concept |
| `prescriptions/views.py:72-123` | **`POST /prescriptions` — no patient authorization at all (IDOR)** |
| `prescriptions/views.py:126-177` | detail/edit gated on prescribing doctor only |
| `prescriptions/views.py:180-238` | finalize gated on prescribing doctor only |
| `prescriptions/views.py:241-302` | revise/cancel gated on prescribing doctor only |
| `prescriptions/views.py:305-321` | PDF via `_can_view` |
| `accounts/urls.py:20-21` | `/patients`, `/patients/<pk>` route shape |

### Tests that encode the old rule

| Location | Test |
|---|---|
| `tests/test_permissions.py:85-102` | `test_doctor_patient_list_scoped_to_own_patients` asserts `[]` |
| `tests/test_security.py:251-266` | `test_doctor_cannot_access_other_doctor_patient` sets `created_by` |
| `tests/test_doctor_portal_gaps.py:176-205` | patch allowed/denied via `created_by` |
| `tests/conftest.py:24-51` | `make_user(..., 'patient')` creates a patient with no access grant |

In addition, **~22 request payloads across 7 test files** pass `patient_id`
(`test_prescriptions.py`, `test_gates.py`, `test_orders.py`, `test_engine.py`,
`test_state_machines.py`, `test_security.py`, `test_debug.py`,
`test_doctor_portal_gaps.py`). Once prescription creation requires consent,
every one of these needs an access grant in its setup. This is the single
largest piece of churn in the change and is the reason to do it in one pass
rather than piecemeal.

### Frontend

| Location | Issue |
|---|---|
| `app/doctor/patients/page.tsx:28` | search hits `/patients?q=` (name search) |
| `app/doctor/patients/page.tsx:39` | copy "Your patients" |
| `app/doctor/patients/new/page.tsx:30-40` | creates a patient directly, no dedupe warning, no handover slip |
| `app/doctor/patients/[id]/page.tsx:33` | loads `/patients/<id>` with no access concept |
| `app/doctor/patients/[id]/page.tsx:36-38` | fetches all `/prescriptions` and filters client-side |
| `app/doctor/patients/[id]/page.tsx:45` | delete patient button |
| `app/doctor/prescriptions/new/page.tsx` | patient picker populated from `/patients` |
| `app/patient/page.tsx` | patient dashboard, no ID / doctors / access log |
| `app/patient/prescriptions/page.tsx` | patient's own prescriptions only |
| `lib/types.ts:11-18` | `Patient` type assumes the old shape |

---

## B. Design

### B1. Identity — one profile per person

`PatientProfile` stays 1:1 with `User` (identity is already global). Changes:

```python
patient_code      = CharField(max_length=12, unique=True)   # MR-4F7K2Q, random
phone_normalized  = CharField(max_length=20, blank=True, db_index=True)
chronic_conditions = TextField(blank=True)
is_claimed        = BooleanField(default=False)
created_by        = FK(User, null=True)   # provenance only, never authorization
```

- `patient_code`: 6 chars from a non-ambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`),
  prefix `MR-`, generated with `secrets.choice`, retried on collision. Never sequential.
- `phone_normalized`: digits only, `+91`/leading `0` stripped, last 10 kept.
  **Not unique** — families share numbers.
- `User.email` stays unique; that remains the one hard dedupe key.
- `User` gains `must_change_password = BooleanField(default=False)`.

`created_by` is kept (no column churn) but removed from every authorization
query and documented as provenance.

### B2. Consent — `CareAccess`

```python
class AccessScope(TextChoices):  BASIC = 'basic'; FULL = 'full'
class AccessStatus(TextChoices): PENDING='pending'; ACTIVE='active'; DENIED='denied'; REVOKED='revoked'; EXPIRED='expired'
class GrantedVia(TextChoices):   PATIENT_APPROVED='patient_approved'; ONE_TIME_CODE='one_time_code'; LEGACY='legacy'

class CareAccess(models.Model):          # StateMachineMixin, status_field_name='status'
    doctor, patient, scope, status, granted_via
    requested_at, granted_at, expires_at, revoked_at
    # unique_together (doctor, patient): one row per pair, re-granted not duplicated
```

`TRANSITIONS`: `pending → active|denied`, `active → revoked|expired`,
`denied → pending`, `revoked → pending`, `expired → pending`.

Status changes use the existing `transition_to()` so every change writes an
audit row transactionally (`config/state_machine.py:85-163`).

One helper, used by every gate:

```python
def access_for(user, patient, scope=None) -> CareAccess | None
    # status=active, revoked_at is null, expires_at > now
```

Expiry is evaluated on read, so no cron/Celery is needed. A lazily-expired row
is flipped to `expired` on the next check.

### B3. One-time in-person code

```python
class PatientAccessCode(models.Model):
    patient, code_hash, expires_at, used_at, attempts, created_at
```

- 6 digits from `secrets.randbelow(10**6)`, zero-padded.
- Stored as `HMAC-SHA256(SECRET_KEY-derived pepper, code)` — not a bare hash.
  A bare hash of a 6-digit space is offline-brute-forceable; the pepper means a
  database leak alone does not reveal codes.
- TTL 10 minutes, single use, 5 wrong attempts void it, redemption throttled
  per doctor and per IP (new throttle scope `access_code`).

### B4. Registration and claim

**Self-registration** (`accounts/views.py:21-63`): after validating the email,
look for an unclaimed profile matching `phone_normalized` + `date_of_birth`
(+ normalized name similarity). If found, do **not** create a second profile;
return `409 {claim_token}` instead, and let the patient claim it by proving
`patient_code` + temp password, or DOB. On claim: same `PatientProfile` row,
`is_claimed=True`, new password, `must_change_password=False`.

**Doctor registers on behalf** (`POST /patients`):

- Requires `name`, `date_of_birth`, `sex`, and `phone` and/or `email`.
- Soft duplicate check: exact `phone_normalized` + exact DOB, or exact DOB +
  exact normalized name. On hit: `409` with a masked hint and a required
  `override_reason` to proceed.
- Creates `User` + `PatientProfile` with `is_claimed=False`,
  `must_change_password=True`.
- Server generates a 12-char temp password, shows it **once** in the response
  for the printable handover slip (patient code, login, temp password,
  instructions), stores only the hash, expires it after 7 days.
- The temp password is never written to `AuditLog`, logs, or notifications.

### B5. What a doctor sees

| Scope | Content |
|---|---|
| `basic` | demographics, allergies, chronic conditions, current medicines (active prescriptions' items) |
| `full` | all of the above + timeline: visits (all doctors), prescriptions from all doctors, MediRelay purchases (pharmacy, date, order status) |

- `Prescription.notes` and `Visit.private_notes` are returned **only to their author**.
- Purchases made outside MediRelay are unknown; the patient may add them
  manually (optional, out of scope for this change).
- Pharmacy view (`PharmacyRxSerializer`) is unchanged.

### B6. `Visit`

```python
class Visit(models.Model):
    patient, doctor, prescription (nullable FK, SET_NULL)
    complaint, diagnosis, private_notes, visited_at, created_at
```

### B7. Endpoints

```
GET    /api/v1/patients                    # patients with ACTIVE access (picker)
GET    /api/v1/patients/search?q=          # exact code | normalized phone | email; masked
POST   /api/v1/patients                    # register on behalf → temp password once
GET    /api/v1/patients/<pk>               # requires active access, else 404
PATCH  /api/v1/patients/<pk>               # requires active access
DELETE /api/v1/patients/<pk>               # access + existing delete guards
GET    /api/v1/patients/<pk>/summary       # basic scope
GET    /api/v1/patients/<pk>/timeline      # full scope
GET    /api/v1/patients/<pk>/visits        # full scope
POST   /api/v1/patients/<pk>/visits        # requires access
POST   /api/v1/access/requests             # doctor → patient
GET    /api/v1/access/requests             # incoming (patient) / outgoing (doctor)
POST   /api/v1/access/requests/<id>/approve|deny
POST   /api/v1/access/code                 # patient generates one-time code
POST   /api/v1/access/code/redeem          # doctor redeems
GET    /api/v1/access                      # patient: my doctors; doctor: my patients
PATCH  /api/v1/access/<id>                 # patient shortens expiry
POST   /api/v1/access/<id>/revoke
GET    /api/v1/access/log                  # patient: who viewed my record
GET    /api/v1/me/patient-code             # patient: own ID
```

`GET /patients` semantics change from "created by me" to "active access" — the
prescription picker keeps working with no shape change.

`GET /patients/search` and the access-code redeem are throttled and audited
with `{'query_hash': sha256(q)[:16]}` — never the raw query.

### B8. Prescription rules

- `POST /prescriptions` and finalize require an active `CareAccess`
  (`prescriptions/views.py:72-123`, `:180-238`). This closes the IDOR above.
- Revocation/expiry is enforced on every read, including timeline and PDF.
- Editing/revising/cancelling stays author-only (unchanged).
- Pharmacy redaction unchanged.

---

## C. Migration plan

Two migrations, applied in order.

**Migration 1 — schema (additive)**

1. `PatientProfile`: add `patient_code` (nullable), `phone_normalized`,
   `chronic_conditions`, `is_claimed`.
2. `User`: add `must_change_password`.
3. Create `CareAccess` and `PatientAccessCode`; create `Visit`.

**Migration 2 — data (`RunPython`, forward-only, idempotent)**

1. For every profile without `patient_code`: generate and assign a unique code.
2. Backfill `phone_normalized` from `User.phone`.
3. `is_claimed = not user.email.endswith('@medirelay.local')`.
4. For every profile with `created_by` set to a user holding a doctor profile:
   `CareAccess.objects.get_or_create(doctor=..., patient=..., defaults={scope:
   FULL, status: ACTIVE, granted_via: LEGACY, expires_at: now + 365d})`.
   Profiles whose creator is not a doctor (or is null) get no grant.
5. Duplicate report: group by `(phone_normalized, date_of_birth)` where phone is
   non-empty, and by `(normalized_name, date_of_birth)`. Print **only** the
   count and the numeric profile ids. No names, phones or DOBs in output.
6. No merging. Duplicates stay as separate profiles until an admin merge tool
   exists (explicitly out of scope).

**Migration 3 — tighten**

Make `patient_code` `unique=True, null=False` once every row is backfilled.

**Rollback:** forward-only. Migrations 1 and 3 are reversible in structure; the
data migration is not (grants and codes are meaningful state). Take a `pg_dump`
before applying on any database with real data.

---

## D. Tests

### Rewritten (old doctor-owns-patient rule)

| Old | New |
|---|---|
| `test_permissions.py:85` `test_doctor_patient_list_scoped_to_own_patients` | `test_patient_list_shows_only_active_access` |
| `test_security.py:251` `test_doctor_cannot_access_other_doctor_patient` | split into `test_doctor_without_access_gets_404` and `test_doctor_with_access_gets_200` |
| `test_doctor_portal_gaps.py:176-205` | patch requires access, not `created_by` |
| `conftest.make_user('patient')` | add a `grant_access` helper; prescription tests opt in |

### New file `tests/test_patient_registry.py`

- anonymous and unverified doctors cannot search
- partial-name search returns nothing
- results are masked (no full phone, no email in the clear)
- search is throttled
- no access → 404 on detail, summary, timeline, prescription create
- revoked access and expired access cut off immediately, including PDF
- patient A cannot approve or revoke access for patient B
- one-time code: single use, expires, stored peppered, 5-attempt lockout
- doctor-created account cannot be used until the password is changed
- temp password never appears in `AuditLog` or notifications; expires after 7 days
- claim flow produces exactly one profile
- another doctor's private `Prescription.notes` and `Visit.private_notes` are never returned
- pharmacy still receives only the redacted serializer
- audit rows exist for search, request, grant, view, revoke
- no endpoint enumerates patients (no unbounded list without access or `q`)

Every security test is written to fail against the current code first.

---

## E. Frontend

**Doctor**

- `/doctor/patients` → "My patients" (active access only) + "Find patient" entry.
- `/doctor/patients/find` → exact-ID/phone/email lookup, masked result cards,
  "Request access", "Enter patient code".
- `/doctor/patients/new` → duplicate warning with required reason, then a
  printable handover slip (patient code, login, temp password, instructions).
- `/doctor/patients/[id]` → tabs: Summary, Timeline, Prescriptions, My notes.
  Delete button stays behind the existing guards.
- `/doctor/prescriptions/new` → picker from `/patients` (unchanged shape).

**Patient**

- `/patient` → own Patient ID, allergies, chronic conditions (editable).
- `/patient/doctors` → approve/deny, shorten expiry, revoke, see the access log.
- "Generate one-time code" action.
- Forced password change when `must_change_password` is true.

`lib/types.ts` gains `patient_code`, `is_claimed`, access and visit types.

---

## F. Effort and risk

**Backend:** ~12 files touched, 3 migrations, ~16 new tests plus ~25 existing
tests adjusted to grant access. The test churn, not the feature code, is the
bulk of the work.

**Frontend:** 2 new pages, 4 pages substantially rewritten.

### Risks

1. **Legal.** Consent records are the lawful basis, but sharing clinical history
   between doctors under DPDP needs a lawyer's review before real use. Not in
   scope for this repo to decide.
2. **Break-glass access is absent.** A doctor cannot treat an unconscious
   patient without consent. This is a real clinical gap and must be a conscious
   "out of scope" decision, not an oversight.
3. **Duplicates are detected but not merged.** Two profiles for one person can
   still be created by a typo'd phone plus a different email. Needs a later
   admin merge tool.
4. **6-digit codes** are weak by nature; TTL, attempt limits and the pepper are
   the actual controls.
5. **Phone normalization** is India-specific (last 10 digits). Documented and
   isolated in one function.
6. **Temp-password delivery** is a printed slip, because there is no email/SMS
   provider. A lost slip means an admin-issued reset, which is manual.
7. **`must_change_password` enforcement** must be a single server-side gate, not
   a frontend redirect, or it is bypassable.

### Decisions requested

1. Confirm `GET /api/v1/patients` changes to "patients with active access".
2. Confirm temp password: 12 chars, shown once, 7-day expiry, printed slip only.
3. Confirm one-time code: 6 digits, 10 min, 5 attempts.
4. Confirm default access 12 months, patient may shorten.
5. Confirm `basic` = demographics/allergies/chronic/current medicines, and
   `full` adds the cross-doctor timeline.
6. Confirm `created_by` stays as provenance (not renamed, never authorization).
7. Confirm break-glass emergency access is out of scope for this change.
8. Confirm no admin merge tool now (duplicates reported only).
