# MediRelay

One prescription. Multiple pharmacies. Transparent prices.

Connected healthcare platform: doctors create digital prescriptions, patients share
them via secure links, pharmacies quote availability and prices, and patients
compare single-store and multi-store options before buying.

**Status:** backend (Django) complete for the core loop — M0 to M5. Frontend is a
minimal auth shell; UI design comes later.

## Stack (v1, local dev)

- **Backend:** Django 6.1 + Django REST Framework, SQLite, session auth
- **Frontend:** Next.js + TypeScript + Tailwind (minimal shell)
- **No** Docker, Redis, Celery, AWS, Keycloak — those are later swaps, not placeholders

## Run the backend

```powershell
cd backend
venv\Scripts\pip install -r requirements.txt   # first time only
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py runserver        # http://localhost:8000
```

Seed an admin (needed for account verification):

```powershell
venv\Scripts\python manage.py createsuperuser
```

Then assign the admin role in the shell:

```powershell
venv\Scripts\python manage.py shell -c "from accounts.models import User, Role; u=User.objects.get(email='you@example.com'); r,_=Role.objects.get_or_create(name='admin'); u.roles.add(r); u.active_role='admin'; u.save()"
```

Note: `django-admin` is available at `/django-admin/` for quick model edits.

## Run tests

```powershell
cd backend
venv\Scripts\python -m pytest -q
```

Release gates covered by tests:

1. Pharmacy cannot access a prescription that was not shared with it
2. Patient cannot read another patient's prescription
3. Concurrent orders cannot oversell stock (and expired batches are never sold)
4. Prescription revision preserves the earlier finalized version
5. A failed notification does not undo a committed prescription

## API

Base path: `/api/v1/`. Full endpoint list lives in each app's `urls.py`.

Core loop:

```
POST /auth/register | /auth/login | /auth/switch-role
GET  /patients (doctor)                POST /patients (doctor creates)
POST /prescriptions                    POST /prescriptions/{id}/finalize
POST /prescriptions/{id}/shares        GET  /shares/{token}   (pharmacy opens)
GET  /pharmacy/requests                POST /quotations       POST /quotations/{id}/submit
POST /price-comparisons                GET  /prescriptions/{id}/quotations
POST /orders                           POST /orders/{id}/fulfillments/{fid}/fulfill
GET  /invoices/{id}/pdf
```

Errors always return `{"detail": str, "code": str}`.

## Design decisions worth knowing

- **Finalized prescriptions are immutable.** Revisions create version N+1 and
  keep the old one readable (`previous_version` chain).
- **Share tokens** are `secrets.token_urlsafe(32)`, stored as SHA-256, returned
  exactly once, revocable, expiring. Every open is logged.
- **Pharmacy sees a scoped view** (items, dosage, patient name/age, allergy flag) —
  never the patient's history, notes or contact details.
- **Quotations reference catalogue medicine ids**, so comparisons are always
  apples-to-apples. Offering a different medicine = substitution, which the
  comparison engine refuses to auto-select.
- **Pack-size rounding:** you pay for whole packs (need 7, pack of 10 → pay 10).
- **Stock is deducted at order time** (FEFO: first expiry first out) inside one
  transaction with row locks; cancellation restocks. Never sold: expired batches,
  quantities quoted short.
- **Notifications are best-effort** — a failure is logged, never rolls back the
  business action.
- **Audit log is append-only**; every prescription access and sensitive action
  writes to it.

## Roadmap

- **Done:** M0 auth/RBAC/audit · M1 prescriptions · M2 inventory · M3 sharing/quotes
  · M4 comparison engine · M5 orders/invoices
- **Next:** frontend portal UI, then patient health records (M6), labs (M7),
  AI/OCR (M8) — each a separate decision, not a placeholder in this code.
