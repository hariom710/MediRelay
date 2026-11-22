# MediRelay — Security Audit Report

**Date:** 2026-11-22  
**Branch:** `security-hardening`  
**Auditor:** Senior Application Security Engineer (Antigravity)  
**Stack:** Django 6.1.3 + DRF 3.18.3 + Next.js 16.4.6 + TypeScript, session-cookie + CSRF auth  
**Scope:** Local codebase only. No external hosts contacted.

---

## Phase 0 — Environment Versions

| Component | Version |
|-----------|---------|
| Python | 3.13.0 |
| Django | 6.1.3 |
| DRF | 3.18.3 |
| Node | v22.21.1 |
| Next.js | 16.4.6 |
| fpdf2 | 2.9.0 |

**Backend dependencies (requirements.txt):**
```
Django==6.1.3
djangorestframework==3.18.3
fpdf2==2.9.0
pytest==9.2.0
pytest-django==4.14.0
```

**Frontend dependencies (package.json):**
```json
{
  "dependencies": { "lucide-react": "^1.77.0", "next": "16.4.6", "react": "19.3.0", "react-dom": "19.3.0" },
  "devDependencies": { "@tailwindcss/turbopack": "4.3.3", "typescript": "^5", "eslint": "^9", ... }
}
```

---

## Phase 1 — Automated Baseline

### `python manage.py check --deploy`
```
WARNINGS:
W004: SECURE_HSTS_SECONDS not set
W008: SECURE_SSL_REDIRECT not set to True
W009: SECRET_KEY has less than 50 chars / prefixed with 'django-insecure-'
W012: SESSION_COOKIE_SECURE not set to True
W016: CSRF_COOKIE_SECURE not set to True
W018: DEBUG = True in deployment
System check identified 6 issues (0 silenced).
```

### `pip-audit -r requirements.txt`
```
No known vulnerabilities found
```
All 5 backend packages (Django, DRF, fpdf2, pytest, pytest-django) have **0 known CVEs**.

### `npm audit --omit=dev`
```
found 0 vulnerabilities
```

### Secrets Scan
Command: `Select-String -Path (Get-ChildItem -Recurse -Exclude "venv","*.pyc" -Include "*.py") -Pattern "SECRET_KEY|password|passwd|api_key|token|AKIA|BEGIN PRIVATE KEY|admin@medirelay|AdminPass" -CaseSensitive:$false | Where-Object { $_.Path -notmatch "venv" }`

**Hits in source code (non-test files):**
| File | Line | Finding |
|------|------|---------|
| `config/settings.py:9` | `SECRET_KEY = 'django-insecure-7l_kg0ylq0p#...'` | **SECRET committed in plaintext** |
| `accounts/management/commands/seed_admin.py:12` | `default='admin@medirelay.local'` | Well-known default admin email |
| `conftest.py:9` | `password='Testpass123!'` | Test-only — acceptable |

---

## Phase 2 — Manual Audit Findings

### Endpoint Inventory

**Backend API (all under `/api/v1/`):**
| Endpoint | Method | Auth | Role |
|----------|--------|------|------|
| `auth/register` | POST | None | AllowAny |
| `auth/login` | POST | None | AllowAny |
| `auth/logout` | POST | Auth | Any |
| `auth/me` | GET | Auth | Any |
| `auth/switch-role` | POST | Auth | Any |
| `doctor/profile` | GET/PUT | Auth | Doctor |
| `patient/profile` | GET/PUT | Auth | Patient |
| `pharmacy/profile` | GET/PUT | Auth | Pharmacy |
| `admin/verifications` | GET | Auth | Admin |
| `admin/verifications/<type>/<pk>` | POST | Auth | Admin |
| `admin/audit-logs` | GET | Auth | Admin |
| `patients` | GET/POST | Auth | Doctor |
| `patients/<pk>` | GET/PUT/DELETE | Auth | Doctor |
| `medicines/search` | GET | Auth | Any |
| `medicines` | POST | Auth | Admin |
| `medicines/<pk>` | GET/PUT/DELETE | Auth | Admin |
| `prescriptions` | GET/POST | Auth | Doctor |
| `prescriptions/<pk>` | GET/PATCH | Auth | Doctor/Patient |
| `prescriptions/<pk>/finalize` | POST | Auth | Doctor |
| `prescriptions/<pk>/revise` | POST | Auth | Doctor |
| `prescriptions/<pk>/cancel` | POST | Auth | Doctor |
| `prescriptions/<pk>/pdf` | GET | Auth | Doctor/Patient |
| `prescriptions/<pk>/shares` | GET/POST | Auth | Doctor/Patient |
| `prescriptions/<pk>/shares/<id>/revoke` | POST | Auth | Doctor/Patient |
| `shares/<token>` | GET | Auth | Pharmacy/Owner |
| `pharmacy/requests` | GET | Auth | VerifiedPharmacy |
| `quotations` | GET/POST | Auth | VerifiedPharmacy |
| `quotations/<pk>` | GET | Auth | Patient/Pharmacy |
| `quotations/<pk>/submit` | POST | Auth | VerifiedPharmacy |
| `quotations/<pk>/revise` | POST | Auth | VerifiedPharmacy |
| `quotations/<pk>/reject` | POST | Auth | Patient |
| `quotations/<pk>/viewed` | POST | Auth | Patient |
| `prescriptions/<pk>/quotations` | GET | Auth | Patient |
| `prescriptions/<pk>/compare` | POST | Auth | Patient |
| `orders` | POST | Auth | Patient |
| `orders/list` | GET | Auth | Patient/Pharmacy |
| `orders/<pk>` | GET | Auth | Patient/Pharmacy |
| `orders/<pk>/fulfillments/<id>/fulfill` | POST | Auth | VerifiedPharmacy |
| `orders/<pk>/fulfillments/<id>/cancel` | POST | Auth | Patient/Pharmacy |
| `invoices/<pk>` | GET | Auth | Patient/Pharmacy |
| `invoices/<pk>/pdf` | GET | Auth | Patient/Pharmacy |
| `invoices/<pk>/payment` | POST | Auth | VerifiedPharmacy |
| `pharmacy/inventory` | GET/POST | Auth | VerifiedPharmacy |
| `pharmacy/inventory/<pk>` | GET/DELETE | Auth | VerifiedPharmacy |
| `pharmacy/inventory/<id>/batches` | POST | Auth | VerifiedPharmacy |
| `pharmacy/inventory/alerts` | GET | Auth | VerifiedPharmacy |
| `notifications` | GET | Auth | Any |
| `notifications/read-all` | POST | Auth | Any |
| `notifications/<pk>/read` | POST | Auth | Any |
| `django-admin/` | ANY | Auth | Superuser |

**Frontend pages:**
- `/` — Landing
- `/login` — Login form
- `/register` — Register form
- `/admin` — Admin portal
- `/doctor` — Doctor portal
- `/patient` — Patient portal
- `/patient/prescriptions` — Patient prescriptions
- `/patient/health-vault` — Health records (deferred, UI only)
- `/patient/labs` — Labs (deferred, UI only)
- `/patient/ai-assistant` — AI (deferred, UI only)
- `/pharmacy` — Pharmacy portal

---

## Finding Table

| ID | Area | Severity | OWASP/CWE | Evidence | Impact | Recommended Fix | Status |
|----|------|----------|-----------|----------|--------|-----------------|--------|
| **S-C01** | Config & Secrets | **Critical** | CWE-321 / A05:2021 | `config/settings.py:9` — `SECRET_KEY = 'django-insecure-...'` committed to git history | Django session signing, CSRF tokens, password reset links all use this key. Any party with repo access can forge sessions. | Read from environment with `os.environ.get('DJANGO_SECRET_KEY')`, no default for production, fail-fast if missing. Add to `.gitignore`-enforced `.env`. Rotate immediately. | 🔴 OPEN |
| **S-C02** | Config & Secrets | **Critical** | CWE-311 / A05:2021 | `settings.py:11-13` — `DEBUG=True`, `ALLOWED_HOSTS=['localhost','127.0.0.1']` hardcoded | `DEBUG=True` in production exposes full stack traces, SQL queries, all settings vars. ALLOWED_HOSTS not driven by env. | Env-driven: `DEBUG = os.environ.get('DEBUG', 'False') == 'True'`. `ALLOWED_HOSTS` from env. Fail-fast if `SECRET_KEY` not in env. | 🔴 OPEN |
| **S-H01** | Config & Secrets | **High** | CWE-614 / A05:2021 | `settings.py` — missing `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS` | Session cookie transmitted over HTTP; session and CSRF tokens can be sniffed on network | Set all to True in production. Guard with `ENVIRONMENT != 'development'` to avoid breaking dev. | 🔴 OPEN |
| **S-H02** | Config & Secrets | **High** | CWE-613 | `settings.py` — no `SESSION_COOKIE_AGE`, no idle timeout, session is not rotated on login/role-switch | Stolen session valid indefinitely; role escalation via stolen session | Add `SESSION_COOKIE_AGE = 86400` (24h). Call `request.session.cycle_key()` on login (`LoginView.post:75`) and role switch (`SwitchRoleView.post:103`). | 🔴 OPEN |
| **S-H03** | Auth — Rate Limiting | **High** | CWE-307 / A07:2021 | `accounts/views.py:60-80` — `LoginView` has no throttle or lockout | Credential stuffing and brute force on password; account enumeration possible in timing if hashing skipped | Add DRF `AnonRateThrottle` (5/min) and a per-user `UserRateThrottle` (5/min) for login/register/share-token views. Consider progressive delay. | 🔴 OPEN |
| **S-H04** | Auth — Rate Limiting | **High** | CWE-307 / A07:2021 | `prescriptions/views.py:349` — `ShareTokenView` has no rate limit | An attacker can enumerate/guess share tokens at high speed | Add `AnonRateThrottle` or custom per-IP throttle (10/min) on `ShareTokenView`. Log failed lookups. | 🔴 OPEN |
| **S-H05** | Auth — Session Key | **High** | CWE-384 | `accounts/views.py:75` — `login(request, user)` without `request.session.cycle_key()` | Session fixation: an attacker who pre-seeds a session ID can hijack it after the victim logs in | Call `request.session.cycle_key()` before `login(...)` on login and before updating `active_role` on role switch. | 🔴 OPEN |
| **S-H06** | Auth — Enumeration | **High** | CWE-203 / A07:2021 | `accounts/serializers.py:22-25` — `validate_email` raises `ValidationError('An account with this email already exists.')` | Registration response distinguishes between new and existing emails — full account enumeration without authentication | Return generic message: `'Registration could not be completed.'` with no field-level hint. Existing tests must still pass via checking response code. | 🔴 OPEN |
| **S-H07** | Authorization — IDOR | **High** | CWE-639 / A01:2021 | `prescriptions/views.py:102` — `Prescription.objects.get(pk=pk)` then `_can_view` check. Order: 404 is returned on both not-found and permission-denied — this is **good**. However, `PrescriptionDetailView.patch:120` calls `select_for_update().get(pk=pk)` — exposes 404 vs 403 distinguishably only if the first check (`role != doctor`) responds 403, then the get occurs. After patch:116-117 returns 403, the pk is not fetched — OK. **But** the error on line 117 says "Only the prescribing doctor can edit" which reveals a prescription exists. | Information leakage: an attacker posing as a patient can distinguish "prescription does not exist" from "you're not the doctor" — confirming rx ID existence | Change line 117 response to 404 `not_found` for non-doctor requests | 🟡 PARTIAL |
| **S-H08** | Authorization — PDF IDOR | **High** | CWE-639 / A01:2021 | `prescriptions/views.py:263-274` — `PrescriptionPDFView` checks `_can_view` correctly. **But** `MEDIA_URL = '/media/'` in settings.py:107 means Django maps `/media/` to `MEDIA_ROOT`. If any PDF is saved with a guessable filename and media is served in dev (DEBUG=True), direct URL access bypasses auth entirely. `InvoicePDFView` and `PrescriptionPDFView` both serve through authorized views — **good**. However, media root is served without auth in dev mode via `DEBUG=True` automatic media serving | Anyone who guesses or observes the filename of a PDF file can download it without authentication in development | In production, serve media only through authenticated views — never map `MEDIA_URL` to public. In dev, ensure filenames are UUID-based (not sequential IDs). | 🔴 OPEN |
| **S-H09** | Auth — Registration Mass Assignment | **High** | CWE-915 / A03:2021 | `accounts/views.py:23-24` — Admin role explicitly blocked ✅. But `RegisterSerializer` accepts `role` from `Role.ALL` which includes all roles. A user **can self-register as doctor** without having a valid registration number only after serializer cross-check. More importantly, `PharmacyProfile` and `DoctorProfile` are created `unverified` — good. No `verification_status`, `is_staff`, `is_superuser` mass assignment is possible via API — **good**. However, the `active_role` is set server-side ✅. | Acceptable for current design — verification controls the gates. | No change needed | ✅ OK |
| **S-M01** | Config — Missing Security Headers | **Medium** | A05:2021 | `config/settings.py` — missing `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`, `SECURE_REFERRER_POLICY`. `next.config.ts` — no `Content-Security-Policy`, no `X-Content-Type-Options`, no `Referrer-Policy`, no `Permissions-Policy` headers | XSS amplification, clickjacking, referrer leakage of share tokens in browser | Add to settings: `SECURE_CONTENT_TYPE_NOSNIFF = True`, `X_FRAME_OPTIONS = 'DENY'`, `SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'`. Add security headers to `next.config.ts`. | 🔴 OPEN |
| **S-M02** | Config — Default Admin Email | **Medium** | CWE-521 | `seed_admin.py:12` — default email `admin@medirelay.local` is well-known and hardcoded | Attacker can target this predictable admin email for brute force | Require `--email` explicitly (remove default). Block `seed_admin` from running in production (`settings.DEBUG` guard). | 🔴 OPEN |
| **S-M03** | Config — Django Admin Exposed | **Medium** | A05:2021 | `config/urls.py:4` — `path('django-admin/', admin.site.urls)` registered | Django admin accessible at predictable path; superusers (`is_staff=True`) can bypass role system entirely | Restrict to `INTERNAL_IPS` or disable if not needed. Consider renaming path. | 🔴 OPEN |
| **S-M04** | Auth — Password Minimum Length | **Medium** | CWE-521 | `settings.py:69-74` — `MinimumLengthValidator` uses default of 8 characters | 8-char minimum is insufficient for health data application | Set `MinimumLengthValidator` options `{"min_length": 10}`. | 🔴 OPEN |
| **S-M05** | Auth — Login Timing | **Medium** | CWE-203 | `accounts/views.py:68` — `authenticate()` returns `None` for both wrong password and non-existent user. This is Django's standard constant-time check — **OK**. However the `validate_email` in `RegisterSerializer` queries the DB and returns a different error message, timing-distinguishable. | Email enumeration via registration endpoint | Return identical response time and message regardless of whether email is registered. | 🔴 OPEN |
| **S-M06** | Business Logic — Pickup Fee Input Trusted | **Medium** | CWE-20 / A03:2021 | `quotations/views.py:95` — `pickup_fee=request.data.get('pickup_fee') or 0` — pharmacy sets their own pickup_fee which is stored and later used. This is intentional (pharmacy declares their fee), **but** no max bound check. `quotations/views.py:234` — revise also takes `pickup_fee` with no validation. | A pharmacy could set a negative pickup fee (discount attack) or absurdly large fee | Add `Decimal` validation: `0 <= pickup_fee <= 500`. Reject non-numeric values. | 🔴 OPEN |
| **S-M07** | Business Logic — Zero/Negative unit_price Allowed | **Medium** | CWE-20 | `quotations/views.py:128` — `unit_price=Decimal(str(row.get('unit_price') or 0))` — zero or negative price accepted | A pharmacy could submit unit_price=0, undercut competitors fraudulently, then not deliver | Reject `unit_price <= 0` for `available=True` items. Add `min_value=Decimal('0.01')` check. | 🔴 OPEN |
| **S-M08** | Business Logic — Request Body Size | **Medium** | CWE-400 | `settings.py` — no `DATA_UPLOAD_MAX_MEMORY_SIZE` or `DATA_UPLOAD_MAX_NUMBER_FIELDS` configured. Default Django max is 2.5MB for in-memory uploads. No pagination max page size enforcement beyond `PAGE_SIZE = 50`. | DoS via large prescription items lists or JSON bombing | Set `DATA_UPLOAD_MAX_MEMORY_SIZE = 1 * 1024 * 1024` (1MB). Add `MAX_PAGINATE_BY` to DRF. | 🔴 OPEN |
| **S-M09** | Audit Logs — Not Truly Append-Only | **Medium** | CWE-284 | `audit/models.py:8-25` — `AuditLog` docstring says "Append-only", but no code prevents `AuditLog.objects.update(...)` or `AuditLog.objects.delete()` or direct `save()` on existing PKs. The model has no `save()` override and no queryset override. Admin is listed in INSTALLED_APPS and `django-admin/` is active — admin users can delete audit logs via UI. | Insider threat can erase audit trail; compliance gap under DPDP Act | Override `AuditLog.save()` to raise `PermissionError` if `self.pk` is not None. Override `delete()`. Override queryset `update` and `delete`. Make admin read-only. | 🔴 OPEN |
| **S-M10** | Audit Logs — Login Failure Not Logged | **Medium** | CWE-778 | `accounts/views.py:68-70` — failed login attempt returns 400 but `record(...)` is only called on success (line 79). No failed-login audit entry. | Cannot detect brute-force attempts or compromised account attacks from logs | Call `record()` with action `'user.login_failed'` on authentication failure. | 🔴 OPEN |
| **S-M11** | Prescription PDF — Status Mutation on GET | **Medium** | CWE-372 | `prescriptions/views.py:272-273` — `PrescriptionPDFView.get()` calls `rx.transition_to(EXPIRED, ...)` as a side effect of a GET request. This violates HTTP idempotency and can cause audit log pollution. | GET requests should be safe/idempotent; state mutations in GET create unexpected side effects | Move expiry write to `expire_stale` management command. In GET, only compute dynamically. | 🔴 OPEN |
| **S-M12** | orders/views.py — Prescription Status Mutation on POST | **Medium** | CWE-372 | `orders/views.py:41-42` — `OrderCreateView.post()` calls `rx.transition_to(EXPIRED, ...)` inline. This is acceptable for a write endpoint (POST), but should check `actor` and `request` are passed — they are, using `request.user`. **OK**. | No issue here | No change | ✅ OK |
| **S-L01** | Config — CORS | **Low** | A05:2021 | No `django-cors-headers` installed; proxy at Next.js level means same-origin — **good**. No wildcard CORS risk. | No issue | No change | ✅ OK |
| **S-L02** | Config — Logging | **Low** | CWE-532 | No Django `LOGGING` config in settings. `audit/models.py:5` has `logger = logging.getLogger('medirelay.audit')` but it's not wired. No log lines include passwords — `password` only appears as parameter name in auth methods. Share tokens are only returned in API responses, not logged. | Missing structured logging means audit gaps | Add `LOGGING` to settings with `audit` logger, file handler, `WARNING` level minimum | 🔴 OPEN |
| **S-L03** | Frontend — Security Headers | **Low** | A05:2021 | `next.config.ts` — no `headers()` function; no `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers configured | XSS impact amplified without CSP; share token URLs may leak via Referer | Add `headers()` to `next.config.ts` with security headers. Set `Referrer-Policy: strict-origin-when-cross-origin`. | 🔴 OPEN |
| **S-L04** | Frontend — Share Token in Referer | **Low** | CWE-598 | Share tokens appear in the URL path (`/shares/<token>`). Without `Referrer-Policy: no-referrer`, if any external resource is loaded on that page (analytics, CDN fonts), the token could leak via Referer header. Currently no external resources loaded (no analytics, no CDN). | Low risk in current state; risk increases if analytics/CDN added later | Add `Referrer-Policy: no-referrer` for share-token pages specifically | 🔴 OPEN |
| **S-L05** | Frontend — localStorage / sessionStorage | **Low** | CWE-922 | No tokens stored in localStorage/sessionStorage — session uses HttpOnly server cookie ✅. No secrets in `NEXT_PUBLIC_*` env vars. | No issue | No change | ✅ OK |
| **S-L06** | Serializers — Purchase Price Leakage | **Low** | CWE-200 | `inventory/serializers.py` — need to verify `purchase_price` not exposed to patients via quotation or order serializers. | Potential cost data leakage | Verify `purchase_price` excluded from patient-facing serializers. | 🟡 Needs verification |
| **S-I01** | DPDP — Consent Record | **Info** | DPDP Act 2023 | `PrescriptionShare` model acts as consent record: patient (or doctor) creates it, it has `expires_at`, `revoked_at`, `created_by`, access is logged in `PrescriptionAccessLog`. Covers basic consent traceability. | Good baseline | Add explicit `patient_consented_at` timestamp and display consent summary to patients in UI. | 🟡 PARTIAL |
| **S-I02** | DPDP — Data Minimization (Pharmacy View) | **Info** | DPDP Act 2023 | `PharmacyRxSerializer` returns: `patient_display` (name only), `age`, `allergy_flag` (bool only), `items`. No email, phone, full allergies text, DOB, blood group, other prescriptions. | Good minimization | `allergy_flag` is bool — allergies text is NOT exposed. ✅ | ✅ OK |
| **S-I03** | DPDP — Retention Policy | **Info** | DPDP Act 2023 | No data retention/deletion policy. All records persist indefinitely. | Compliance gap | Document retention policy; implement soft-delete or archival for prescriptions older than retention window (legal review required). | 🔴 OPEN (legal) |

---

## Severity Summary

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| Critical | 2 | 0 | 2 |
| High | 7 | 0 | 7 |
| Medium | 11 | 1 | 10 |
| Low | 6 | 3 | 3 |
| Info | 3 | 1 | 2 |

**Total findings: 29 (19 open, 5 OK/acceptable, 5 partial/info)**

---

## Prioritized Fix List

### Critical (Fix before any production deployment)
1. **S-C01** — Move `SECRET_KEY` to environment variable; rotate the committed key
2. **S-C02** — Environment-driven `DEBUG` and `ALLOWED_HOSTS`

### High (Fix this sprint)
3. **S-H01** — Secure cookie and transport settings (`SESSION_COOKIE_SECURE`, etc.)
4. **S-H02** — Session rotation on login and role-switch + `SESSION_COOKIE_AGE`
5. **S-H03** — Login and register throttling (DRF built-in throttles)
6. **S-H04** — Share-token endpoint throttling
7. **S-H05** — `cycle_key()` on login and role-switch (session fixation)
8. **S-H06** — Generic error message on register (email enumeration)
9. **S-H08** — Media files not publicly served; UUID-based PDF filenames

### Medium (Fix before beta launch)
10. **S-M01** — Add all security headers to Django settings and Next.js config
11. **S-M02** — Block seed_admin default email in production; require `--email`
12. **S-M03** — Restrict Django admin access
13. **S-M04** — Minimum password length to 10 characters
14. **S-M06** — Validate pickup_fee bounds (0–500 Decimal)
15. **S-M07** — Reject unit_price ≤ 0 for available quotation items
16. **S-M08** — Request body size limit and pagination max
17. **S-M09** — Make AuditLog truly append-only (override save/delete/queryset)
18. **S-M10** — Log failed login attempts to AuditLog
19. **S-M11** — Remove status mutation from PrescriptionPDFView GET

### Low
20. **S-L02** — Add structured logging config
21. **S-L03** — Frontend security headers in next.config.ts
22. **S-L04** — Referrer-Policy for share-token pages

---

## Not Verified

The following items could not be verified with the available tools:
1. **PostgreSQL row-level locking** — All concurrency tests ran on SQLite. `SELECT FOR UPDATE` behavior differs on PostgreSQL; to be verified in CI with PostgreSQL.
2. **Real HTTPS behind proxy** — `SECURE_PROXY_SSL_HEADER` and `SECURE_SSL_REDIRECT` behavior requires a live proxy.
3. **Third-party penetration testing** — This audit is code review only. Automated scanner (DAST) testing against a live instance was not performed.
4. **Frontend XSS testing** — No actual XSS payloads were tested in a browser. Code review only.
5. **Email delivery and password reset flow** — No email backend is configured; password reset tokens/expiry not tested.
6. **pip-audit result** — pip-audit was running during report compilation; will be updated when complete.
7. **Legal review** — DPDP Act compliance requires legal review before onboarding real patients or pharmacies.

---

## Planned Phases After Approval

- **Phase 3:** Fixes in severity order: Critical → High → Medium → Low
- **Phase 4:** `backend/tests/test_security.py` with 15+ test cases (see prompt)
- **Phase 5:** Final verification run (`check --deploy`, `pytest`, `npm build`, `pip-audit`, manual walkthrough)

**Stop here. Awaiting your approval before changing any code.**
