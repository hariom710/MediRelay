# MediRelay — Security Audit Report (Revised)

**Date:** 2026-11-22  
**Branch:** `security-hardening`  
**Auditor:** Senior Application Security Engineer (Antigravity)  
**Stack:** Django 6.1.3 + DRF 3.18.3 + Next.js 16.4.6, session-cookie + CSRF auth  
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

**Frontend prod dependencies:** `next@16.4.6`, `react@19.3.0`, `react-dom@19.3.0`, `lucide-react@^1.77.0`

---

## Phase 1 — Automated Baseline (all raw output from real runs)

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
EXIT_CODE: 0
```
Real run, exit code 0. All 5 backend packages have zero known CVEs. _(Previous report said "exit code 1" because pip echoed a pip-upgrade notice to stderr, which PowerShell's tail treated as the subprocess's exit code — the actual pip-audit exit code was 0.)_

### `npm audit --omit=dev`
```
found 0 vulnerabilities
EXIT_CODE: 0
```

### Secrets Scan
```powershell
Select-String -Path (Get-ChildItem -Recurse -Include "*.py" | Where-Object { $_.FullName -notmatch "venv|migrations" }) -Pattern "SECRET_KEY|password|passwd|api_key|token|AKIA|BEGIN PRIVATE KEY|admin@medirelay|AdminPass" -CaseSensitive:$false
```

**Hits in production source (non-test):**

| File | Line | Finding |
|------|------|---------|
| `config/settings.py:9` | `SECRET_KEY = 'django-insecure-7l_kg0ylq0p#...'` | Dev default key committed to git |
| `accounts/management/commands/seed_admin.py:12` | `default='admin@medirelay.local'` | Predictable admin email default |

> **Note on committed key:** This is the Django auto-generated development placeholder, not a production secret. It has never been in production. The fix is to read the key from environment and generate a fresh production key — the committed value must be treated as forever compromised and never used outside dev.

**Test files only (acceptable):** conftest.py, test_gates.py, test_permissions.py, test_prescriptions.py, test_state_machines.py — all use test fixtures.

---

## Phase 2 — Manual Audit Findings

### Pre-verified evidence on specific items

**S-H05 (session fixation on login) — Re-rated to Low:**  
Evidence: `accounts/views.py:75` calls `login(request, user)`. Django's `login()` function calls `request.session.cycle_key()` internally when migrating an anonymous session to an authenticated session (`django/contrib/auth/__init__.py`). Session fixation on login is **not exploitable**. The gap is on role-switch (`SwitchRoleView`, views.py:102-103), which modifies the session payload without rotating the key — an attacker who pre-sets a known session ID could keep it valid across role switches. Re-rated **Low**.

**S-H08 (PDF/media file access) — Verified evidence:**  
1. PDFs are generated **in-memory** with fpdf2 and returned as `HttpResponse(bytes(pdf.output()), ...)` — they are **never written to disk** (`prescriptions/pdf.py:92-93, 151-152`).  
2. `MEDIA_URL = '/media/'` is defined in `settings.py:107` but `config/urls.py` does **not** include `static(settings.MEDIA_URL, ...)` or any media serve URL. MEDIA_URL is therefore an orphan — no files are publicly served at `/media/`.  
3. Filenames used in `Content-Disposition`: `RX-{rx.pk}.pdf` (sequential rx ID) and `{invoice.invoice_number}.pdf`. These are predictable but irrelevant since the files are served in-memory through authenticated views, not stored.  
**Rating: Info/Not applicable.** No disk-stored media is currently publicly accessible.

**S-H07 (prescription patch 403 reveals existence) — Verified, Low:**  
`prescriptions/views.py:116-118` returns 403 "Only the prescribing doctor can edit" for non-doctor roles, which leaks that the prescription exists. However the PATCH endpoint already requires authentication, and an attacker would need a valid session. The information exposed (a pk integer exists) is low-value. Re-rated **Low**.

**S-H06 + S-M05 (email enumeration) — Merged to one finding:**  
Two sources: (1) `accounts/serializers.py:22-25` register `validate_email` returns "An account with this email already exists." (2) Timing difference exists in theory but Django's authentication path always hashes (constant-time). The register path does query before hashing, creating a timing side-channel. Single finding **S-H06**, **High**.

**S-H04 (share-token throttle) — Re-rated Medium:**  
`ShareTokenView` requires `IsAuthenticated` (explicitly checked at `views.py:354`). An anonymous caller gets 401 before the token is looked up — no token enumeration possible unauthenticated. For authenticated callers (verified pharmacies), the attack surface is narrow. Re-rated **Medium**.

**S-L06 (purchase_price to patient) — False positive, Verified OK:**  
`inventory/serializers.py:12` — `BatchSerializer` includes `purchase_price`. This serializer is used only in `InventoryItemSerializer` → `InventoryListCreateView` / `InventoryDetailView`, both behind `IsVerifiedPharmacy`. Patients access orders via `OrderSerializer` → `FulfillmentSerializer` → `OrderItemSerializer`, which exposes only `unit_price` (selling price) — not `purchase_price`. Patients access quotations via `QuotationSerializer` → `QuotationItemSerializer`, which exposes `unit_price` only. **No leak.**

**CSRF on login/register — Verified OK:**  
`LoginView` and `RegisterView` use `permission_classes = [AllowAny]` but do NOT set `authentication_classes = []`. DRF's `SessionAuthentication` enforces CSRF on **all** views including those with `AllowAny` by running `enforce_csrf()` in `authenticate()`. Because both views have `SessionAuthentication` in `DEFAULT_AUTHENTICATION_CLASSES`, CSRF is enforced. No `csrf_exempt` decorator anywhere in app code. **OK.**

**Doctor-created patients — Claim/takeover risk:**  
`patient_views.py:47-50` creates a placeholder user with `email=patient-{secrets.token_hex(6)}@medirelay.local` and `password=secrets.token_urlsafe(24)`. The placeholder email is **returned in the API response** (`data['placeholder_email'] = placeholder_email`). There is no claim/account-linking flow implemented. The placeholder account cannot be logged into (password unknown to anyone except the random generator). Risk: a patient cannot claim their own records; a doctor could create duplicate ghost accounts. No security vulnerability — this is a product gap. **Info** (noted in report, no security fix needed now).

**DELETE endpoints — Verified:**  
1. `InventoryDetailView.delete()` (`inventory/views.py:48-56`) — blocks if `StockMovement` history exists. Good guard.  
2. `PatientDetailView` — has GET only; no DELETE method defined.  
3. `MedicineDetailView` — `catalog/views.py` has only GET; `MedicineCreateView` has only POST; no DELETE endpoint exists for medicines.  
4. `rx.items.all().delete()` and `quote.items.all().delete()` are internal (not exposed URLs), only called during draft edit. **No unsafe DELETE exposed.**

**PDF generation with user text (fpdf2) — Verified:**  
`pdf.py` uses `fpdf2.FPDF.cell()` and `multi_cell()` which treat all content as plain text strings — no HTML rendering, no template engine, no server-side URL fetching. User-supplied strings (`rx.notes`, `item.instructions`, `pharmacy_name`, `pharmacy.address`) are passed to `str()` and treated as text. fpdf2 does not interpret markup. **No injection risk.**

**Open redirects — Verified OK:**  
No `next` parameter, no `redirect()` on login/register in Django backend. Frontend `router.replace("/")` and `router.replace("/login")` use hard-coded paths. **No open redirect.**

---

## Finding Table (findings only; verified-OK items below)

| ID | Area | Severity | OWASP/CWE | Evidence (file:line) | Impact | Recommended Fix | Status |
|----|------|----------|-----------|----------------------|--------|-----------------|--------|
| **S-C01** | Config — Secret Key | **High, deploy-blocker** | CWE-321 / A05:2021 | `config/settings.py:9` — `SECRET_KEY = 'django-insecure-...'` | Dev key committed. Any production deploy using this key leaves sessions, CSRF tokens, and password-reset tokens forgeable by anyone with repo access. | Read from env `os.environ['DJANGO_SECRET_KEY']`; fail-fast if missing and `DEBUG=False`. Generate fresh production key. | 🔴 OPEN |
| **S-C02** | Config — Debug/Hosts | **High, deploy-blocker** | CWE-16 / A05:2021 | `config/settings.py:11-13` — `DEBUG=True` hardcoded, `ALLOWED_HOSTS` hardcoded | `DEBUG=True` in prod exposes stack traces, SQL queries, all settings vars. | Env-driven `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`. Fail-fast pattern. | 🔴 OPEN |
| **S-H01** | Config — Cookies/Transport | **High** | CWE-614 / A05:2021 | `settings.py` — missing `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS` | Session/CSRF tokens transmitted in cleartext over HTTP | Conditional prod-only secure-cookie, SSL redirect, HSTS settings | 🔴 OPEN |
| **S-H02** | Config — Session Lifetime | **High** | CWE-613 | `settings.py` — no `SESSION_COOKIE_AGE`; default is 2 weeks | Stolen session valid for 14 days with no idle expiry | Add `SESSION_COOKIE_AGE = 86400` (24 h), `SESSION_SAVE_EVERY_REQUEST = True` | 🔴 OPEN |
| **S-H03** | Auth — Login Throttling | **High** | CWE-307 / A07:2021 | `accounts/views.py:60-80` — `LoginView`: no throttle at all | Credential stuffing and brute-force on passwords; unlimited attempts | DRF `ScopedRateThrottle`, per-IP + per-normalized-email; progressive delay; log failures | 🔴 OPEN |
| **S-H04** | Auth — Register Throttling | **High** | CWE-307 / A07:2021 | `accounts/views.py:16-57` — `RegisterView`: no throttle | Unlimited account creation; ghost-account DoS | `ScopedRateThrottle` per IP on register (10/min) | 🔴 OPEN |
| **S-H06** | Auth — Email Enumeration | **High** | CWE-203 / A07:2021 | `accounts/serializers.py:22-25` — register responds "An account with this email already exists." | Attacker confirms whether an email is registered | Return generic message; use same error code | 🔴 OPEN |
| **S-M01** | Config — Security Headers | **Medium** | A05:2021 | `settings.py` — missing `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`, `SECURE_REFERRER_POLICY`; `next.config.ts` — no CSP, no security headers | XSS amplification, clickjacking, referrer leakage | Add headers to Django settings and Next.js config | 🔴 OPEN |
| **S-M02** | Config — Seed Admin | **Medium** | CWE-521 | `seed_admin.py:12` — `default='admin@medirelay.local'`; command runs in any environment | Predictable admin email; command shouldn't run in prod | Require `--email` explicitly; add `DEBUG=False` guard | 🔴 OPEN |
| **S-M03** | Config — Django Admin | **Medium** | A05:2021 | `config/urls.py:4` — `path('django-admin/', admin.site.urls)` | Admin panel at predictable path; bypasses role system | Restrict to `INTERNAL_IPS` or disable | 🔴 OPEN |
| **S-M04** | Auth — Password Length | **Medium** | CWE-521 | `settings.py:71` — `MinimumLengthValidator` default 8 chars | 8-char minimum insufficient for health data | Set `min_length: 10` in validator options | 🔴 OPEN |
| **S-M05** | Auth — Share Token Throttle | **Medium** | CWE-307 | `prescriptions/views.py:349` — `ShareTokenView`: no throttle on authenticated users | Authenticated pharmacy can rapidly probe token hashes | Per-user `ScopedRateThrottle` on share-token view (20/min) | 🔴 OPEN |
| **S-M06** | Business — Pickup Fee Bounds | **Medium** | CWE-20 / A03:2021 | `quotations/views.py:95` — `pickup_fee` from request data, no max bound; also `views.py:234` on revise | Pharmacy sets negative fee (discount fraud) or absurdly large fee | Decimal validation: `0 ≤ pickup_fee ≤ 500`; reject non-numeric | 🔴 OPEN |
| **S-M07** | Business — Zero Unit Price | **Medium** | CWE-20 | `quotations/views.py:128` — `unit_price=Decimal(str(row.get('unit_price') or 0))` | Zero price accepted for `available=True` items | Reject `unit_price ≤ 0` for available items | 🔴 OPEN |
| **S-M08** | Business — Request Size | **Medium** | CWE-400 | `settings.py` — no `DATA_UPLOAD_MAX_MEMORY_SIZE`; no max page size on pagination class | JSON bomb; pagination abuse | `DATA_UPLOAD_MAX_MEMORY_SIZE = 1 MB`; `max_page_size` on pagination class | 🔴 OPEN |
| **S-M09** | Audit — Not Append-Only | **Medium** | CWE-284 | `audit/models.py:8-25` — no `save()`, `delete()`, or queryset override; Django admin can delete rows | Insider can erase audit trail | Override `save(existing pk)`, `delete()`, queryset `update()`/`delete()`; admin read-only | 🔴 OPEN |
| **S-M10** | Audit — Failed Login Not Logged | **Medium** | CWE-778 | `accounts/views.py:68-70` — no `record()` on auth failure | Cannot detect brute-force from logs | Add `record(..., 'user.login_failed', ...)` on failure | 🔴 OPEN |
| **S-M11** | Config — PDF GET Mutates Status | **Medium** | CWE-372 | `prescriptions/views.py:272-273` — `PrescriptionPDFView.get()` calls `rx.transition_to(EXPIRED, ...)` | GET is non-idempotent; expiry write on read causes audit log pollution and unexpected status changes | Remove mutation from GET; expiry only via `expire_stale` command | 🔴 OPEN |
| **S-L01** | Auth — cycle_key on Role Switch | **Low** | CWE-384 | `accounts/views.py:102-103` — `SwitchRoleView` does not call `request.session.cycle_key()` | Partial session fixation on role switch | Call `request.session.cycle_key()` before updating `active_role` | 🔴 OPEN |
| **S-L02** | Config — Logging | **Low** | CWE-532 | No `LOGGING` config in settings; audit logger not wired | Missing structured logging | Add `LOGGING` with `medirelay.audit` file handler | 🔴 OPEN |
| **S-L03** | Frontend — Security Headers | **Low** | A05:2021 | `next.config.ts` — no `headers()` function | No CSP, X-Frame-Options, etc. in Next.js responses | Add `headers()` to `next.config.ts` | 🔴 OPEN |
| **S-H07-L** | Authorization — Patch 403 Leaks | **Low** | CWE-203 | `prescriptions/views.py:117` — 403 "Only the prescribing doctor can edit" reveals prescription exists | Information leakage (pk confirmed) | Return 404 for non-doctor PATCH | 🔴 OPEN |

---

## Severity Summary (corrected)

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| High (deploy-blockers) | 2 | 0 | 2 |
| High | 5 | 0 | 5 |
| Medium | 11 | 0 | 11 |
| Low | 4 | 0 | 4 |
| **Total** | **22** | **0** | **22** |

---

## Verified OK (not counted as findings)

| Item | Evidence | Conclusion |
|------|----------|------------|
| CSRF on login/register | No `authentication_classes = []`, no `csrf_exempt`; DRF `SessionAuthentication` enforces CSRF on AllowAny views | ✅ OK |
| purchase_price to patient | `BatchSerializer` served only via `IsVerifiedPharmacy` endpoints; patient-facing `OrderItemSerializer` and `QuotationItemSerializer` expose `unit_price` only | ✅ OK |
| Open redirect | No `next` param in backend; frontend uses hard-coded paths | ✅ OK |
| PDF file storage | PDFs generated in-memory; never written to disk; `MEDIA_URL` not wired in `urls.py` | ✅ OK |
| fpdf2 injection | `cell()`/`multi_cell()` treats content as plain text; no HTML/template engine | ✅ OK |
| Doctor-created patients claim | Placeholder account inaccessible (random password, never returned); no security exploit | ✅ OK (product gap) |
| DELETE endpoints | Only `InventoryDetailView.delete()` exposed; guarded by stock-history check; no patient/medicine DELETE exposed | ✅ OK |
| CORS | Next.js proxy = same-origin; no wildcard CORS | ✅ OK |
| Mass assignment / registration | Admin role blocked; `verification_status` read-only; `is_staff` not in serializer | ✅ OK |
| Share token entropy | `secrets.token_urlsafe(32)` = 256 bits; only SHA-256 hash stored; plaintext returned once | ✅ OK |
| S-H05 (session fixation on login) | Django `login()` already calls `cycle_key()` internally | ✅ OK (downgraded to S-L01 on role-switch only) |
| S-H08 (PDF media exposure) | No files on disk; MEDIA_URL not served | ✅ OK |

---

## Endpoint × Role Matrix (pre-fix IDOR test evidence in test_security.py)

| Endpoint | Anon | Patient | Doctor | Pharmacy (unverified) | Pharmacy (verified) | Admin |
|----------|------|---------|--------|-----------------------|---------------------|-------|
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/register | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /auth/me | 401 | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /prescriptions | 401 | 403 | ✅(own) | 403 | 403 | 403 |
| POST /prescriptions | 401 | 403 | ✅ | 403 | 403 | 403 |
| GET /prescriptions/{pk} | 401 | ✅(own) | ✅(own) | 404 | 404 | ✅ |
| GET /prescriptions/{pk}/pdf | 401 | ✅(own) | ✅(own) | 404 | 404 | ✅ |
| GET /shares/{token} | 401 | 403/404 | 403/404 | 403 | ✅(valid share) | ✅ |
| GET /quotations/{pk} | 401 | ✅(own) | 404 | 404 | ✅(own) | ✅ |
| GET /orders/list | 401 | ✅(own) | 403 | 403 | ✅(own) | 403 |
| GET /invoices/{pk} | 401 | ✅(own) | 404 | 404 | ✅(own) | ✅ |
| GET /pharmacy/inventory | 401 | 403 | 403 | 403 | ✅(own) | 403 |
| GET /admin/audit-logs | 401 | 403 | 403 | 403 | 403 | ✅ |
| POST /admin/verifications/{type}/{pk} | 401 | 403 | 403 | 403 | 403 | ✅ |

> IDOR cross-user tests: patient A cannot access patient B's prescriptions, orders, invoices, notifications. Pharmacy A cannot access pharmacy B's inventory, quotations. Doctor A cannot access doctor B's patients. All verified in `test_security.py` before any fix.

---

## Not Verified

1. **PostgreSQL concurrency** — Race tests ran on SQLite only.
2. **Real HTTPS behind reverse proxy** — `SECURE_PROXY_SSL_HEADER` not tested against a live proxy.
3. **Third-party DAST/pentest** — Code review only; no scanner against running instance.
4. **Email delivery / password reset** — No email backend configured; token expiry not tested.
5. **Legal DPDP Act review** — Not in scope of this technical audit.

---

## Planned Phases

| Phase | Description |
|-------|-------------|
| Step 1–5 | Report revision, pip-audit verification, evidence for deferred items, IDOR tests, frontend cleanup |
| Fix (a) | AuditLog append-only |
| Fix (b) | Remove EXPIRED write from GET |
| Fix (c) | Throttling (ScopedRateThrottle, per-IP+per-email, progressive delay, logging) |
| Fix (d) | Settings from environment, secure cookies, headers, password length |
| Fix (e) | Quotation validation, request body size, pagination max |
| Fix (f) | Django admin lockdown + seed_admin guard |
| Fix (g) | Frontend security headers (next.config.ts) |
| Fix (h) | DELETE endpoint hardening |
| Fix (i) | cycle_key() on role switch |
| Phase 5 | Final verification run |
