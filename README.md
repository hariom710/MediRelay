<div align="center">

# MediRelay

**A clinical-grade, transparent prescription-to-pharmacy fulfillment platform for India — with verified digital prescriptions, multi-store price comparisons, and FEFO atomic inventory.**

[![Django](https://img.shields.io/badge/Django-6.1.3-092E20?logo=django&logoColor=white)](https://www.djangoproject.com)
[![DRF](https://img.shields.io/badge/DRF-3.18.3-red?logo=django&logoColor=white)](https://www.django-rest-framework.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Database](https://img.shields.io/badge/Database-SQLite%20(dev)%20%2F%20PostgreSQL%20(prod)-4169E1?logo=postgresql&logoColor=white)](#tech-stack)
[![Tests](https://img.shields.io/badge/tests-156%20passed-brightgreen?logo=pytest&logoColor=white)](#testing--verification)
[![License](https://img.shields.io/badge/license-Proprietary%20%2F%20MIT-blue)](#license)

[Features](#features) · [Tech stack](#tech-stack) · [Architecture](#architecture) · [Data flow & state machines](#data-flow--state-machines) · [Installation & setup](#installation--setup) · [Usage walkthrough](#usage-walkthrough) · [Security & privacy](#security-compliance--privacy) · [Testing & verification](#testing--verification) · [Limitations & known gaps](#limitations--known-gaps) · [Roadmap](#roadmap)

</div>

---

## Introduction

**MediRelay** is a digital healthcare platform that bridges doctors, patients, and licensed retail pharmacies across India. It transforms the conventional, error-prone paper prescription journey into a tamper-evident digital workflow: doctors write structured prescriptions, patients share them securely using time-limited, scoped cryptographic tokens, pharmacies submit itemized stock and price quotations, and a deterministic comparison engine calculates the optimal purchasing strategy (both single-pharmacy and multi-store combinations) before allocating inventory using strict First-Expiry-First-Out (FEFO) accounting.

### The problem it solves

In the traditional Indian retail healthcare landscape:
1. **Unintelligible & Fragile Prescriptions:** Handwritten paper prescriptions lead to dispensing errors, unauthorized brand substitutions, and lost treatment records.
2. **Opaque Medicine Pricing & Availability:** Patients physically travel between multiple medical stores or make repeated phone calls to check stock for specialized or chronic drugs.
3. **Arbitrary Brand Substitutions:** Pharmacists frequently substitute prescribed molecules with alternate brands without structured doctor or patient consent.
4. **Lack of FEFO Traceability:** Many small pharmacies struggle with batch tracking, resulting in near-expiry stock dispensing or inventory discrepancies.
5. **No Unified Cost Comparison:** Patients needing multiple medicines have no straightforward method to compare costs across competing local pharmacies or evaluate whether splitting an order across two stores saves money.

### Who it is for

- **Patients:** Who want clear price visibility, guaranteed stock reservation, freedom from store-hopping, and organized digital health records.
- **Doctors:** Who require a clean, fast prescribing tool with dosage validation, duplicate active-ingredient alerts, patient allergy warnings, and immutable versioning.
- **Licensed Pharmacies:** Who want structured prescription requests, catalog-linked quotation tools, automated batch-level FEFO stock deduction, and instant PDF invoice generation.
- **Healthcare Administrators:** Who oversee pharmacy and doctor credential verification and require an append-only audit trail of every clinical document access.

### Why Django + Next.js

MediRelay uses a **modular Django monolith** paired with a **Next.js App Router** frontend:
- **ACID Transactions over Microservice Chaos:** Core pharmaceutical workflows (stock reservations, price comparisons, invoice locking) demand strict serializability. Using Django's atomic database transactions (`transaction.atomic()` and `select_for_update()`) ensures zero risk of double-selling or distributed state inconsistency.
- **Session-Based Authentication with Role Context:** All authentication operates via HTTP-only session cookies and CSRF protection, with an explicit `active_role` session parameter enabling multi-role users (e.g., a doctor who is also a patient) to switch contexts securely without JWT leakage.
- **No Premature Complexity:** MediRelay intentionally omits Celery, Redis, RabbitMQ, Kafka, or external payment gateways in its core phase. Background-style dispatches (like notifications) execute gracefully in-process with transactional fault-tolerance.

### Maturity & Verification Status

MediRelay has a **fully functional, verified core loop (Milestones M0 through M5)** backed by **156 automated tests** in pytest. Every critical release gate — unauthorized access prevention, cross-patient isolation, oversell protection, version immutability, security hardening, and state-machine transitions — is exercised and passing.

> [!NOTE]
> In an exhaustive independent codebase audit conducted in November 2026, experimental modules for Tier C features (such as synthetic AI OCR and third-party laboratory stubs) were identified and cleanly segregated. MediRelay makes zero unverified claims: everything documented in this guide is verified by real code and automated test execution.

---

## Features

### 1. Digital Prescription Engine (M1)
- **Structured Medication Regimens:** Supports explicit morning, afternoon, evening, and night timings, meal associations (before/after/with food), and duration in days.
- **Dosage-Form Arithmetic:** Automatically quantizes solid dosage forms (tablets, capsules) into integer pack units while handling liquid formulations (syrups, drops, suspensions) with precision.
- **Clinical Safety Checks:** Evaluates patient allergy profiles against prescribed drugs and alerts doctors to duplicate active ingredients in real time.
- **Tamper-Evident Finalization:** Prescriptions transition from `DRAFT` to `FINALIZED`. Once finalized, a prescription is permanently immutable. Any subsequent modification spawns an incremented revision version (Version $N+1$) that preserves the immutable `previous_version` pointer.
- **Direct PDF Export:** Clean, professional prescription PDFs generated server-side using `fpdf2`.

### 2. Scoped Cryptographic Sharing (M3)
- **Zero-Exposure Public Links:** Patients share prescriptions via ephemeral 32-byte cryptographic tokens (`secrets.token_urlsafe(32)`).
- **Hashed Token Storage:** Only SHA-256 hashes of share tokens are stored in the database. Raw plaintext tokens are returned exactly once upon creation.
- **Data Minimization:** Pharmacies opening a shared token see only what is medically necessary to quote: medicine names, strengths, dosages, duration, patient age, gender, and allergy warnings. Private clinical notes, doctor personal remarks, and patient contact details are strictly redacted.
- **Configurable Expiry & Revocation:** Shares default to a 7-day lifespan and can be revoked by the patient at any moment with immediate effect.

### 3. Pharmacy Quotations & Anti-Substitution Safeguards (M3)
- **Catalog-Linked Quoting:** Quotations bind directly to unique catalog medicine identifiers, ensuring exact matches on active molecules and strengths.
- **Strict Anti-Substitution Guard:** If a pharmacy offers an alternative brand (`offered_medicine_id`), MediRelay automatically flags it as a substitution. The engine explicitly **refuses to auto-accept substitutions**, requiring explicit review and consent.
- **Itemized Pricing & Fees:** Pharmacies quote unit prices, available quantities, and store-specific pickup or handling fees.
- **Quotation Freezing:** Once a patient accepts a quotation, the quote transitions to `SELECTED` and is permanently frozen against edits.

### 4. Intelligent Price Comparison Engine (M4)
MediRelay features a deterministic comparison engine that analyzes submitted quotations and executes two distinct purchasing algorithms:
- **Mode 1: Cheapest Complete Single Pharmacy:** Finds the lowest-cost single pharmacy that can fulfill 100% of the prescribed items. Avoids split pickups and calculates accurate line totals including whole-pack rounding math.
- **Mode 2: Cheapest Multi-Store Combination:** Formulates the optimal mathematical combination across up to 15 pharmacies to minimize total patient expenditure. Calculates composite medicine prices alongside distinct pharmacy pickup/handling fees.
- **Pack-Size Rounding Math:** Prices reflect actual pack purchases rather than fractional pills (e.g., if 7 tablets are prescribed and the manufacturer sells 10-tablet blisters, the patient is quoted for 1 blister of 10).
- **Deterministic Tie-Breaking:** Ties between equal-cost options are resolved consistently by price, then pharmacy identifier.

### 5. Inventory & FEFO Stock Allocation (M2, M5)
- **Batch-Wise Tracking:** Tracks batch numbers, manufacturing dates, expiry dates, purchase cost, and Maximum Retail Price (MRP).
- **First-Expiry-First-Out (FEFO):** When an order is placed, stock is deducted strictly from the active batch with the earliest upcoming expiry date.
- **Expired Stock Exclusion:** Batches past their expiry date are automatically excluded from available inventory and blocked from sale.
- **Atomic Concurrency Protection:** Stock reservation operates inside a database transaction with row locks, preventing race conditions, phantom reads, or overselling.
- **Automated Restocking on Cancellation:** If an order fulfillment is cancelled, the exact batches deducted are restored, and audit log entries are generated.

### 6. Invoicing & PDF Receipts (M5)
- **Itemized Breakdown:** Generates official invoices detailing medicine names, batch numbers, expiry dates, HSN/SAC codes, quantities, unit prices, pickup fees, and applicable taxes.
- **Server-Side PDF Rendering:** Invoices can be downloaded as print-ready PDF documents generated via `fpdf2`.
- **Payment Lifecycle:** Supports `PENDING`, `PAID`, `FAILED`, and `REFUNDED` states with full fulfillment auditing.

### 7. Governance, Verification & Audit Ledger (M0)
- **Admin Verification Gate:** Unverified doctors cannot issue prescriptions; unverified pharmacies cannot view shared prescriptions or submit quotes.
- **Append-Only Audit Log:** High-integrity `AuditLog` records every sensitive operation: prescription views, token creations, quotation submissions, order cancellations, and admin approvals.
- **Active Role Switching:** Allows users registered with multiple roles (e.g., a doctor who also manages their personal healthcare) to switch roles without re-authenticating.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Backend Framework** | Django | 6.1.3 | Core business logic, ORM, security, and admin |
| **REST API** | Django REST Framework | 3.18.3 | Serializers, permissions, viewsets, and JSON endpoints |
| **PDF Generation** | fpdf2 | 2.9.0 | Lightweight, standalone PDF generation for Rx & Invoices |
| **Backend Testing** | pytest & pytest-django | 9.2.0 / 4.14.0 | Unit, integration, security gate, and concurrency tests |
| **Frontend Framework** | Next.js (App Router) | 16.4.6 | React server and client components, routing |
| **UI Library** | React | 19.3.0 | Reactive component rendering |
| **Styling** | Tailwind CSS | 4.3.3 | Utility-first styling with flat clinical design tokens |
| **Language** | TypeScript | 5.x | End-to-end static typing on frontend |
| **Database** | SQLite (Dev) / PostgreSQL (Prod) | 3.x / 16+ | ACID relational persistence with row-level locks |
| **Authentication** | Django Session / CSRF | Built-in | Secure HTTP-only cookies with `active_role` context |

---

## Architecture

```mermaid
flowchart TD
    classDef actor fill:#e2e8f0,stroke:#475569,stroke-width:2px;
    classDef core fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px;
    classDef secure fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef store fill:#dcfce7,stroke:#15803d,stroke-width:2px;

    Doc["Doctor"]:::actor -->|1. Draft & Finalize Rx| RxEngine["Prescriptions Engine (M1)"]:::core
    RxEngine -->|Immutable Version Chain| DB[("Relational Database")]:::store
    
    Patient["Patient"]:::actor -->|2. Generate Scoped Link| ShareService["Share Token Service (M3)"]:::secure
    ShareService -->|SHA-256 Hash Stored| DB
    
    Pharm["Licensed Pharmacy"]:::actor -->|3. Open Token & Quote| QuoteEngine["Quotation Service (M3)"]:::core
    QuoteEngine -->|Item Prices & Pickup Fee| DB
    
    Patient -->|4. Request Comparison| CompEngine["Price Comparison Engine (M4)"]:::core
    CompEngine -->|Mode 1: Single Pharmacy| CompEngine
    CompEngine -->|Mode 2: Multi-Store Combo| CompEngine
    
    Patient -->|5. Place Order| OrderService["Order & Fulfillment (M5)"]:::core
    OrderService -->|6. Atomic FEFO Deduction| InvService["FEFO Inventory (M2)"]:::core
    InvService -->|Lock Rows & Reserve Batches| DB
    
    OrderService -->|7. Generate Receipt| InvoiceGen["fpdf2 PDF Generator"]:::core
    InvoiceGen -->|Downloadable PDF| Patient
```

### Directory Structure

```text
MediRelay/
├── backend/
│   ├── manage.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── config/                     # Settings, URL routing, state machine mixins, exceptions
│   │   ├── settings.py
│   │   ├── state_machine.py        # Declarative StateMachineMixin & transition validation
│   │   ├── exceptions.py          # Unified {"detail", "code"} error handlers
│   │   └── urls.py
│   ├── accounts/                   # Custom User, Role, Doctor/Patient/Pharmacy profiles
│   ├── catalog/                    # Master medicine database & pack sizing
│   ├── prescriptions/              # Digital prescriptions, versioning, PDF, share tokens
│   ├── inventory/                  # Pharmacy inventory, batch tracking, FEFO deduction
│   ├── quotations/                 # Quotation submissions, anti-substitution, comparison engine
│   ├── orders/                     # Orders, order fulfillments, restocking, invoicing
│   ├── audit/                      # Append-only audit logging ledger
│   ├── notifications/              # In-transaction user notification dispatch
│   └── tests/                      # 156 passing automated tests covering all release gates & security
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Public landing
│       │   ├── login/              # Session authentication
│       │   ├── register/           # Multi-role registration
│       │   ├── doctor/             # Prescribing desk, allergy alerts, patient search
│       │   ├── patient/            # Prescriptions, share links, price comparison, orders
│       │   ├── pharmacy/           # Requests inbox, quotation builder, fulfillment
│       │   └── admin/              # Credential verification queue & audit ledger
│       └── components/             # Flat clinical UI components
└── docs/
    └── AUDIT_REPORT.md             # Comprehensive forensic audit & test evidence report
```

---

## Data Flow & State Machines

MediRelay guarantees that business entities transition through explicit, legal lifecycles enforced at the model layer by `config.state_machine.StateMachineMixin`. Any unauthorized or out-of-order transition immediately raises `InvalidStateTransitionError`.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> DRAFT
    DRAFT --> FINALIZED: Doctor Confirms
    DRAFT --> CANCELLED: Doctor Aborts
    FINALIZED --> REVISED: Doctor Issues Revision (creates v+1)
    FINALIZED --> EXPIRED: Validity Window Closes
```

### Transition Specifications

| Entity | Initial State | Allowed Target States | Enforcing Transition Method |
|:---|:---|:---|:---|
| **Prescription** | `DRAFT` | `FINALIZED`, `CANCELLED` | `finalize()`, `cancel()` |
| | `FINALIZED` | `REVISED`, `CANCELLED`, `EXPIRED` | `revise()`, `cancel()`, `expire()` |
| **PrescriptionShare** | `ACTIVE` | `REVOKED`, `EXPIRED` | `revoke()`, `expire()` |
| **Quotation** | `DRAFT` | `SUBMITTED` | `submit()` |
| | `SUBMITTED` | `VIEWED`, `SELECTED`, `REJECTED`, `EXPIRED`, `DRAFT` | `mark_viewed()`, `select()`, `reject()`, `expire()`, `revert_to_draft()` |
| | `SELECTED` | `SUBMITTED`, `EXPIRED`, `DRAFT` | `revert_to_draft()`, `expire()` |
| **Order** | `PLACED` | `COMPLETED`, `CANCELLED` | `complete()`, `cancel()` |
| **OrderFulfillment** | `PENDING` | `IN_PROGRESS`, `FULFILLED`, `CANCELLED` | `start_processing()`, `fulfill()`, `cancel()` |
| | `IN_PROGRESS`| `READY_FOR_PICKUP`, `FULFILLED`, `CANCELLED` | `mark_ready()`, `fulfill()`, `cancel()` |
| | `READY_FOR_PICKUP` | `FULFILLED`, `CANCELLED` | `fulfill()`, `cancel()` |
| **Invoice** | `PENDING` | `PAID`, `FAILED` | `mark_paid()`, `mark_failed()` |
| | `PAID` | `REFUNDED` | `refund()` |
| | `FAILED` | `PENDING` | `transition_to(PENDING)` |
| **MedicineBatch** | `ACTIVE` | `DEPLETED`, `EXPIRED`, `QUARANTINED`, `WRITTEN_OFF` | `deplete()`, `mark_expired()`, `quarantine()`, `write_off()` |
| | `DEPLETED` | `ACTIVE`, `WRITTEN_OFF` | `reactivate()`, `write_off()` |
| | `EXPIRED` | `WRITTEN_OFF` | `write_off()` |
| **Notification** | `UNREAD` | `READ`, `ARCHIVED` | `mark_read()`, `archive()` |
| | `READ` | `ARCHIVED` | `archive()` |
| **Doctor / Pharmacy** | `PENDING` | `UNDER_REVIEW`, `VERIFIED`, `REJECTED` | `submit_for_review()`, `verify()`, `reject()` |
| | `UNDER_REVIEW` | `VERIFIED`, `REJECTED` | `verify()`, `reject()` |
| | `VERIFIED` | `SUSPENDED` | `suspend()` |

---

## 🚀 How to Run the Project (Quick Start Guide)

Follow these step-by-step instructions to run both the Django backend and Next.js frontend on your local machine.

### System Prerequisites
Make sure the following tools are installed on your system:
- **Python:** Version 3.12 or 3.13 (`python --version`)
- **Node.js:** Version 20.x or higher (`node --version`)
- **Git:** Installed and configured (`git --version`)
- **Supported Operating Systems:** Windows (PowerShell / CMD), macOS, Linux

---

### Step 1: Clone the Repository
```powershell
git clone https://github.com/hariom710/MediRelay.git
cd MediRelay
```

---

### Step 2: Backend Setup & Execution (Terminal 1)

The backend is built with Django 5.2 and Django REST Framework. In development mode (`DJANGO_DEBUG=True`, default), **zero environment variables are needed**; it uses a safe default secret key and local SQLite (`db.sqlite3`).

1. Open a terminal and navigate to the `backend` folder:
   ```powershell
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt):**
     ```cmd
     python -m venv venv
     venv\Scripts\activate.bat
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Apply database migrations:
   ```powershell
   python manage.py migrate
   ```

5. Seed default system roles (`doctor`, `patient`, `pharmacy`, `admin`):
   ```powershell
   python manage.py seed_roles
   ```

6. Seed the initial administrative user:
   ```powershell
   python manage.py seed_admin --email admin@example.com --password AdminPassword123!
   ```
   > [!NOTE]
   > The `seed_admin` management command requires explicit `--email` and `--password` flags and runs exclusively in development (`DJANGO_DEBUG=True`).

7. Start the Django development server:
   ```powershell
   python manage.py runserver 127.0.0.1:8000
   ```
   - **Backend API root:** [http://127.0.0.1:8000/api/v1/](http://127.0.0.1:8000/api/v1/)
   - Keep this terminal window open while running the application.

---

### Step 3: Frontend Setup & Execution (Terminal 2)

The frontend is built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS. The Next.js dev server proxies all `/api/*` requests directly to `http://localhost:8000`, ensuring cross-origin cookies work effortlessly without CORS issues.

1. Open a **new, separate terminal** and navigate to the `frontend` folder:
   ```powershell
   cd frontend
   ```

2. Install Node dependencies:
   ```powershell
   npm install
   ```

3. Start the Next.js development server:
   ```powershell
   npm run dev
   ```
   - **Frontend Web Portal:** [http://localhost:3000](http://localhost:3000)
   - Keep this terminal running alongside Terminal 1.

---

### Step 4: Accessing Application Portals

Once both servers are running, access the following URLs in your web browser:

| Portal / Page | URL | Purpose & Features |
|:---|:---|:---|
| **Landing Page** | [http://localhost:3000](http://localhost:3000) | Public overview, feature walkthrough, quick portal switcher |
| **Login** | [http://localhost:3000/login](http://localhost:3000/login) | Authenticate into your account (session-cookie based) |
| **Register** | [http://localhost:3000/register](http://localhost:3000/register) | Create a new Patient, Doctor, or Pharmacy profile |
| **Doctor Portal** | [http://localhost:3000/doctor](http://localhost:3000/doctor) | Prescribing desk, allergy alerts, prescription finalization |
| **Patient Portal** | [http://localhost:3000/patient](http://localhost:3000/patient) | Active prescriptions, 7-day share tokens, price comparison, ordering |
| **Pharmacy Portal** | [http://localhost:3000/pharmacy](http://localhost:3000/pharmacy) | Requests inbox, itemized quotation builder, order fulfillment |
| **Admin Portal** | [http://localhost:3000/admin](http://localhost:3000/admin) | Doctor & pharmacy license verification desk, append-only audit trail |
| **Django Admin** | [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/) | Django built-in ORM administration (`DJANGO_ENABLE_ADMIN=True`) |

---

### Step 5: End-to-End Demo Walkthrough

To experience the complete prescription-to-fulfillment flow from scratch:

1. **Log in as Administrator:**
   - Go to [http://localhost:3000/login](http://localhost:3000/login)
   - Sign in with: `admin@example.com` / `AdminPassword123!`
   - Access the Admin Desk at [http://localhost:3000/admin](http://localhost:3000/admin).

2. **Register Clinical Stakeholders:**
   - Register a **Doctor** (e.g. `doctor@example.com` with a medical registration number).
   - Register a **Pharmacy** (e.g. `pharmacy@example.com` with a drug store license).
   - Register a **Patient** (e.g. `patient@example.com`).

3. **Verify Providers:**
   - In the Admin Desk ([http://localhost:3000/admin](http://localhost:3000/admin)), click **Approve** on the newly registered Doctor and Pharmacy profiles.

4. **Prescribe & Fulfill:**
   - Log in as the **Doctor**: Create a structured prescription for the patient with medication items, dosage schedules, and click **Finalize Prescription**.
   - Log in as the **Patient**: View the finalized prescription and click **Share** to generate a cryptographic 7-day share link.
   - Log in as the **Pharmacy**: View the shared prescription, input item pricing and pickup fees, and click **Submit Quotation**.
   - Return to the **Patient**: Compare quotes across single and multi-pharmacy combinations, select the best quote, and click **Order Now**.
   - The system atomically reserves stock under **FEFO** rules and generates a downloadable PDF receipt.

---

### Environment Variables Reference

| Variable | Default (Dev) | Description |
|:---|:---|:---|
| `DJANGO_DEBUG` | `True` | Set `False` in production to enforce strict security checks |
| `DJANGO_SECRET_KEY` | Dev fallback key | **Required** when `DJANGO_DEBUG=False`. Fails fast if missing |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of permitted hostnames |
| `DJANGO_CSRF_TRUSTED_ORIGINS`| `http://localhost:3000,http://127.0.0.1:3000` | Allowed origins for state-mutating requests |
| `DJANGO_NUM_PROXIES` | `0` | Number of reverse proxies (e.g., Nginx, Next.js) in front of Django |
| `DJANGO_CACHE_BACKEND` | `locmem` | Cache engine (`locmem`, `redis`, `memcached`) |
| `DJANGO_ENABLE_ADMIN` | `True` in dev, `False` in prod | Toggles Django admin interface URL route |

---

## Usage Walkthrough

### Step 1: Admin Verifies Credentials
1. Log in to the Admin Portal (`/admin`).
2. Review the pending registration queue for newly registered doctors and pharmacies.
3. Verify medical registration numbers and drug store licenses. Click **Approve**.

### Step 2: Doctor Issues a Digital Prescription
1. Log in as a verified doctor (`/doctor`).
2. Search for an existing patient or create a new patient profile.
3. Add medication items: select medicine, specify dosage (e.g., 1-0-1), meal conditions, and duration in days.
4. If an allergy matches the patient's record, a real-time clinical warning is rendered.
5. Click **Finalize Prescription**. The prescription is now locked and assigned version `1`.

### Step 3: Patient Generates a Scoped Share Link
1. Log in as the patient (`/patient`).
2. Locate the finalized prescription and click **Share**.
3. The platform generates an ephemeral, cryptographically secure share link (valid for 7 days).
4. Share the link with participating pharmacies, or send it to all local pharmacies in the network.

### Step 4: Pharmacies Submit Quotations
1. A licensed pharmacy opens the request in their portal (`/pharmacy`).
2. The pharmacy reviews the redacted clinical view (medications, strengths, patient age, allergies).
3. For each item, the pharmacy enters available inventory, unit prices, and store pickup fees.
4. Click **Submit Quotation**.

### Step 5: Patient Compares Prices & Places Order
1. The patient opens the price comparison screen on their prescription.
2. The comparison engine outputs:
   - **Mode 1 (Single Store):** The cheapest single store providing 100% of items.
   - **Mode 2 (Multi-Store):** The absolute lowest combined price across multiple stores including pickup fees.
3. The patient selects their preferred quotation and clicks **Order Now**.

### Step 6: Atomic FEFO Deduction & Invoicing
1. The backend automatically queries the winning pharmacy's inventory batches.
2. The earliest-expiring active batches are deducted atomically using `select_for_update()`.
3. An `OrderFulfillment` record and an itemized `Invoice` are generated.
4. The patient downloads the official invoice PDF (`/api/v1/invoices/{id}/pdf/`) and picks up their order.

---

## Security, Compliance & Privacy

### 1. Data Minimization & Scoped Pharmacy Views
Prescription sharing adheres strictly to the principle of least privilege. When a pharmacy views a prescription via a share token:
- **Exposed:** Medicine names, strengths, quantities, dosage instructions, patient age, gender, and allergy warnings.
- **Redacted:** Patient phone number, residential address, email, doctor's private consultation notes, and historical medical conditions.

### 2. Cryptographic Token Handling
- Tokens are generated using high-entropy random bytes (`secrets.token_urlsafe(32)`).
- The raw token is returned to the user **once** and never stored in plain text.
- The database stores a one-way `SHA-256` hash. Every lookup computes the hash and queries against the digest.
- Tokens enforce an absolute 7-day expiration window and can be revoked by the patient instantly.

### 3. Rigorous Role & Object-Level Access Control
- Every API endpoint enforces role verification via `active_role` session attributes (`IsDoctor`, `IsPatient`, `IsVerifiedPharmacy`, `IsAdminRole`).
- Object-level permissions prevent IDOR (Insecure Direct Object Reference) vulnerabilities: patients can never view prescriptions belonging to other patients; unverified providers receive `403 Forbidden` on all clinical actions.

### 4. Indian Regulatory Alignment (CDSCO & Drugs and Cosmetics Act)
- **Schedule H / H1 Compliance:** Prescriptions must be finalized and verified before dispensing; no quotation or order can be created without a valid, doctor-signed digital prescription.
- **Strict Anti-Substitution Rule:** Section 65 of the Drugs and Cosmetics Rules mandates dispensing the prescribed formulation. MediRelay prohibits automatic substitution matching: any generic or brand alternative offered by a pharmacy must be explicitly marked and approved.
- **Digital Personal Data Protection (DPDP) Act Readiness:** Full audit trails log every instance of clinical data viewing. The patient retains complete control over share revocation.

---

## Testing & Verification

MediRelay maintains an uncompromising, automated testing suite built on `pytest` and `pytest-django`.

```powershell
cd backend
python -m pytest -q
```

### Current Test Suite Status
```text
============================= 156 passed in 204.33s =============================
```

### Release Gates & Hardening Covered by Automated Tests

| Gate / Security Area | Scope & Risk Prevented | Test Location | Key Test Functions |
|:---|:---|:---|:---|
| **Gate 1: Access Isolation** | Unauthorized pharmacy access to unshared prescriptions | `tests/test_gates.py` | `test_gate_pharmacy_cannot_access_unshared_prescription` |
| **Gate 2: Cross-Patient Isolation** | Cross-patient prescription IDOR data leaks | `tests/test_gates.py` | `test_gate_patient_cannot_read_another_prescriptions` |
| **Gate 3: FEFO Concurrency** | Concurrent overselling & expired batch sales under FEFO | `tests/test_gates.py` | `test_gate_concurrent_orders_cannot_oversell_fefo` |
| **Gate 4: Immutability** | Tampering or loss of history during prescription revision | `tests/test_gates.py` | `test_gate_prescription_revision_preserves_immutable_version` |
| **Gate 5: Fault Isolation** | Database rollback caused by auxiliary notification failures | `tests/test_gates.py` | `test_gate_failed_notification_does_not_rollback_prescription` |
| **State Machine Gates** | Invalid lifecycle transitions across domain models | `tests/test_state_machines.py` | `test_prescription_state_machine`, `test_threaded_concurrent_transitions` |
| **Catalog & Anti-Substitution** | Unintended automatic medicine brand substitutions | `tests/test_engine.py` | `test_substitution_flagged_and_rejected_from_comparison` |
| **Security Hardening (A-I)** | Anti-lockout throttling, proxy IP resolution, PDF sanitization, IDOR | `tests/test_security.py` | 54 comprehensive security tests |

### Running Concurrency & Race Tests on PostgreSQL

In local development, automated concurrency tests (`test_concurrent_transition_conditional_update`, `test_threaded_concurrent_transitions`, and `test_gate3_concurrent_orders_cannot_oversell_fefo`) execute on SQLite using atomic conditional `UPDATE` validation. While SQLite enforces table-level serial writes, PostgreSQL provides true row-level locks via `select_for_update()` and multiversion concurrency control (MVCC).

To run the complete test suite against PostgreSQL:
1. Ensure PostgreSQL is running and create a test database:
   ```sql
   CREATE DATABASE medirelay_test;
   ```
2. Set the `DATABASE_URL` environment variable:
   ```powershell
   $env:DATABASE_URL="postgres://postgres:password@localhost:5432/medirelay_test"
   ```
3. Execute pytest:
   ```powershell
   cd backend
   python -m pytest tests/test_state_machines.py -v
   ```

---

## Limitations & Known Gaps

In adherence to radical engineering honesty, the following constraints and deferred modules are explicitly disclosed:

1. **SQLite Concurrency in Development:** In local development, MediRelay runs on SQLite. SQLite executes database-level locks rather than row-level locks; therefore, `select_for_update()` is functionally a no-op on SQLite. **PostgreSQL is required in production** to realize genuine row-level lock serialization under high concurrency.
2. **Tier C Deferred Modules:** An earlier prototype included preliminary stubs for `health_records`, `laboratories`, and `ai_services`. Because these lacked real external infrastructure (no OCR libraries, no encryption SDKs, and no diagnostic API partners), they were formally audited and marked as **Tier C (Out of Scope)**. They do not participate in the core prescription-to-pharmacy fulfillment loop.
3. **UI Visual Polish:** The frontend client is currently transitioning from an early prototype styling pass to a strict flat clinical design system (eliminating unnecessary glassmorphism and backdrop filters).
4. **Mock Payment Settlement:** Payment processing currently supports manual marking (`PENDING`, `PAID`, `REFUNDED`) suitable for Cash-on-Delivery (COD) or in-store UPI collection. Direct integration with Razorpay or Cashfree payment gateways is scheduled for Phase 3.

---

## Roadmap

### Phase 1: Core Fulfillment Hardening (Current)
- [x] Complete M0 to M5 backend core loop.
- [x] Implement declarative `StateMachineMixin` across all domain models.
- [x] 156 passing automated tests covering all security, concurrency, and release gates.
- [x] Apple-grade design system implemented across all portals (HIG typography, glass materials, interactive comparison engine).
- [x] Comprehensive security audit & hardening report (`docs/SECURITY_REPORT.md`).
- [x] Zero-dependency local developer quick start with safe dev defaults.

### Phase 2: Design Refinement & Clinical Extras (Near-Term)
- [ ] Complete flat clinical design system migration on frontend (zero glassmorphism).
- [ ] Add pharmacy inventory management views (batch addition, stock adjustment).
- [ ] QR code generation for instant in-store prescription scanning.
- [ ] Patient consent log recording every token creation and revocation.

### Phase 3: Production Hardening & Ecosystem Integration
- [ ] PostgreSQL migration with verified `select_for_update` row locks.
- [ ] Celery + Redis for asynchronous notification delivery and PDF generation offloading.
- [ ] Ayushman Bharat Digital Mission (ABDM) M1/M2 milestone compliance (ABHA ID integration).
- [ ] Razorpay / UPI payment gateway integration.

---

## Troubleshooting

### 1. `The token '&&' is not a valid statement separator`
- **Cause:** Attempting to chain shell commands with `&&` inside Windows PowerShell.
- **Fix:** Use `;` instead of `&&` in PowerShell:
  ```powershell
  python manage.py migrate; python manage.py runserver
  ```

### 2. `Port 3000 (or 8000) is already in use`
- **Cause:** A previous instance of Next.js or Django is already running on the port.
- **Fix (Windows):**
  ```powershell
  # Find PID occupying port 3000:
  Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
  # Terminate process:
  taskkill /PID <PID> /F
  ```
- **Fix (macOS / Linux):**
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

### 3. `Execution of scripts is disabled on this system` (PowerShell)
- **Cause:** Windows PowerShell execution policy restricts running virtual environment activation scripts.
- **Fix:** Run the following command in PowerShell:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### 4. `ImproperlyConfigured: Requested setting INSTALLED_APPS`
- **Cause:** Running `pytest` or Python commands from the repository root instead of the `backend/` directory.
- **Fix:** Always change directory into `backend` before running tests or management commands:
  ```powershell
  cd backend
  python -m pytest -q
  ```

### 5. CSRF Verification Failed on API Calls
- **Cause:** Making state-mutating requests (`POST`, `PATCH`, `DELETE`) without including the `X-CSRFToken` header.
- **Fix:** Fetch the CSRF token from the `csrftoken` cookie set by `/api/v1/auth/login` and pass it in the `X-CSRFToken` header of all subsequent mutations.

### 6. PDF Generation / `UnicodeDecodeError` in Reports
- **Cause:** Conflict between legacy `fpdf` and modern `fpdf2`.
- **Fix:** Ensure only `fpdf2==2.9.0` is installed:
  ```powershell
  pip uninstall -y fpdf
  pip install fpdf2==2.9.0
  ```

---

## Contributing

1. Fork the repository and create a feature branch (`git checkout -b feature/clinical-enhancement`).
2. Run backend checks:
   ```powershell
   cd backend
   python manage.py check
   python -m pytest -q
   ```
3. Run frontend checks:
   ```powershell
   cd frontend
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
4. Commit your changes with descriptive commit messages.
5. Submit a Pull Request targeting `main`.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments

- **Django Software Foundation** for the rock-solid web framework and ORM.
- **Django REST Framework** for clean, flexible API design patterns.
- **Central Drugs Standard Control Organisation (CDSCO)** for regulatory guidelines informing Indian digital healthcare standards.
