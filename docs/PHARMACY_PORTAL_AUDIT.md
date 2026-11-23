# Pharmacy Portal Audit

## Summary Counts

| Status | Count | Description |
|---|---|---|
| DONE | 6 | Fully implemented and wired to real data |
| PARTIAL | 38 | Some functionality exists, significant gaps remain |
| STUB | 5 | Page exists but calls wrong/non-existent endpoint or renders no real data |
| MISSING | 12 | Feature not implemented at all |
| NEEDS BACKEND | 10 | Requires backend endpoint that doesn't exist |

**Total IDs audited: 71 (P0.1-P12.9)**

### DONE (6)
P0.4, P2.4, P3.3, P3.7, P4.8, P5.6

### PARTIAL (38)
P0.1, P0.2, P0.3, P0.5, P1.3, P1.4, P2.1, P2.2, P3.1, P3.2, P3.4, P3.5, P4.1, P4.2, P4.4, P4.5, P4.6, P4.7, P5.1, P5.2, P5.3, P5.5, P5.7, P6.2, P6.4, P6.5, P6.6, P6.8, P6.9, P6.10, P7.1, P7.2, P7.3, P7.4, P7.5, P9.2, P9.3, P9.4, P9.5, P10.1, P10.2, P11.1, P11.2, P11.3, P11.4, P11.5, P11.6, P12.1-P12.9 (18 items)

### STUB (5)
P1.1, P1.2, P8.1, P9.1, P2.3

### MISSING (12)
P0.2 (banner), P3.6, P4.3, P5.4, P6.1, P6.3, P6.7, P7.6, P8.7, P9.1, P10.3, P11.7

### NEEDS BACKEND (10)
1. No pharmacy dashboard endpoint
2. No invoice list endpoint
3. No pharmacy order list endpoint (OrderListView is IsPatient only)
4. PharmacyProfile model missing: phone, opening_hours, contact_person, default_pickup_fee, default_validity_days, pin_code
5. No stock adjustment endpoint
6. No stock ledger read endpoint
7. No expired batch write-off endpoint
8. No quotation withdraw endpoint
9. No pickup code check endpoint
10. No quotation detail endpoint for pharmacy (QuotationDetailView is generic)

---

## Detailed Audit: P0.1 – P12.9

| ID | Status | Evidence / Gap |
|---|---|---|
| P0.1 | PARTIAL | Shell has `role="pharmacy"` guard via `api("/auth/me")` + redirect; 401 handling redirects to login but no return-to-page-afterwards |
| P0.2 | MISSING | No verification banner component exists; no disabling of quote/stock/fulfill actions for unverified pharmacies |
| P0.3 | PARTIAL | Navigation defined in Shell NAV["pharmacy"] (8 items); no unread count badge on Notifications nav item |
| P0.4 | DONE | Role switcher + logout in Shell (lines 106-120 of shell.tsx) |
| P0.5 | PARTIAL | Page headers exist on all pharmacy pages; no breadcrumbs on detail pages |
| P1.1 | STUB | `/pharmacy/page.tsx` calls `GET /pharmacy/dashboard` which does NOT exist → 404; dashboard shows error state. Counts would need to come from multiple paginated list calls (incorrect) |
| P1.2 | STUB | Recent requests/orders lists reference `data.recent_requests` and `data.recent_orders` from non-existent dashboard endpoint; renders empty or error |
| P1.3 | PARTIAL | Quick action links exist (verify share, add stock, view orders) but no dedicated "verify share link" box on dashboard |
| P1.4 | DONE | Empty state with first-steps explanation exists on dashboard (`<Card>` with step-by-step text) |
| P2.1 | PARTIAL | PharmacyProfile model has: pharmacy_name, address, city. Missing: phone, opening_hours, contact_person, pin_code. Serializer only exposes: pharmacy_name, license_number, address, city, verification_status, verification_note |
| P2.2 | PARTIAL | Licence number shown read-only; verification status shown; rejection reason shown via verification_note |
| P2.3 | STUB | Frontend profile page has default_pickup_fee and default_validity_days inputs, but backend model has NO such fields → PUT fails validation |
| P2.4 | DONE | ChangePasswordView exists at `/auth/change-password` (E4 from doctor portal) |
| P3.1 | PARTIAL | Inventory list exists with medicine_name, selling_price, available_qty, batches; status badges (low/out/expired) computed client-side but basic |
| P3.2 | PARTIAL | Search by name exists client-side; filters (low/out/expiring) exist client-side; no server-side pagination or sort |
| P3.3 | DONE | POST `/pharmacy/inventory` creates item; duplicate returns 400 (unique_together constraint on pharmacy+medicine) |
| P3.4 | PARTIAL | Selling price editable via PATCH; no validation warning when selling price > MRP of any batch |
| P3.5 | PARTIAL | DELETE `/pharmacy/inventory/<pk>` exists with 409 for referenced items; no deactivate option |
| P3.6 | MISSING | No medicine detail panel; catalogue details (manufacturer, etc.) not shown |
| P3.7 | DONE | Purchase price only in BatchSerializer; not exposed in InventoryItemSerializer to other roles |
| P4.1 | PARTIAL | Batches shown in InventoryItemSerializer; batch fields: number, expiry, qty, mrp, purchase_price; no date_received field |
| P4.2 | PARTIAL | POST `/pharmacy/inventory/<item_id>/batches` exists; validation: expiry future, qty positive; duplicate batch number UPDATES qty instead of erroring |
| P4.3 | MISSING | No stock adjustment endpoint; quantity only changes via batch create |
| P4.4 | PARTIAL | StockMovement model exists (append-only); no read endpoint for ledger; no UI to view movements |
| P4.5 | PARTIAL | is_expired property exists on MedicineBatch; expired batches excluded from available_qty; no write-off endpoint |
| P4.6 | PARTIAL | Stock movements are atomic; no explicit negative-stock check in batch create (qty must be positive for "in") |
| P4.7 | PARTIAL | ExpiryAlertView exists at `/pharmacy/inventory/alerts` with low_stock, expiring_soon, expired; no per-item threshold |
| P4.8 | DONE | Every stock change writes to audit log via record() |
| P5.1 | PARTIAL | `/pharmacy/requests` returns list with share_id, prescription_id, opened, expires_at, my_quotation_id; no status filter/pagination |
| P5.2 | PARTIAL | Frontend has verify share link box calling `/shares/<token>`; wrong/expired/revoked tokens show error; no throttling on frontend |
| P5.3 | PARTIAL | `/shares/<token>` returns redacted prescription; patient name limited; but no strength/form/dosage in the response? Need to verify |
| P5.4 | MISSING | No per-medicine inventory match in the share response; frontend doesn't show stock status |
| P5.5 | PARTIAL | Share inactive check (410) exists; banners for expired/revoked not in frontend |
| P5.6 | DONE | Access log recorded on share open; pharmacy cannot edit prescription |
| P5.7 | PARTIAL | "New" badge shown; "open prescription" action exists but leads to request detail, not quotation builder |
| P6.1 | MISSING | No quotation builder frontend; QuotationListCreateView exists (POST with share_id, items) |
| P6.2 | PARTIAL | Backend validates quantity offered <= stock; frontend has no builder |
| P6.3 | MISSING | No pack-size display in frontend |
| P6.4 | PARTIAL | Substitution supported in backend (_save_items handles offered_medicine); frontend has no UI |
| P6.5 | PARTIAL | Pickup fee parsed and validated (0-500); validity enforced (1-14 days); frontend has no builder |
| P6.6 | PARTIAL | Partial quotations allowed (available toggle per item); frontend has no builder |
| P6.7 | MISSING | No stock reservation reminder in frontend |
| P6.8 | PARTIAL | Save as draft (POST creates draft), submit (POST /submit) exists; frontend has no builder |
| P6.9 | PARTIAL | Backend validates prices, quantities, pickup fee bounds; frontend has no builder |
| P6.10 | PARTIAL | After submission quotation is read-only (status check); status timeline not in frontend |
| P7.1 | PARTIAL | Quotation list exists with status filter; no search/pagination beyond 100 limit |
| P7.2 | PARTIAL | Revise endpoint exists (POST /revise) with active fulfillment check; frontend has no UI |
| P7.3 | PARTIAL | Revision history not explicitly returned; revision number shown in serializer |
| P7.4 | PARTIAL | Expired quotations marked (is_expired); cannot be selected; frontend doesn't show expired state |
| P7.5 | PARTIAL | Selected quotation shows order_id; frontend doesn't display |
| P7.6 | MISSING | No withdraw endpoint for draft/submitted quotations |
| P8.1 | STUB | `/pharmacy/orders/page.tsx` calls `GET /orders/list` which is `IsPatient` only → pharmacies get 403. No pharmacy order list endpoint exists. |
| P8.2 | PARTIAL | OrderDetailView exists (pharmacy can view via fulfillment check); FEFO batch allocation in serializer; frontend has no detail page |
| P8.3 | PARTIAL | FulfillView exists (idempotent); frontend has no fulfill action |
| P8.4 | PARTIAL | CancelFulfillmentView exists (restores stock); frontend has no cancel action |
| P8.5 | PARTIAL | Stock allocation errors returned as 409; frontend doesn't handle |
| P8.6 | PARTIAL | State machine enforced; frontend doesn't show valid actions only |
| P8.7 | MISSING | No pickup code check endpoint or UI |
| P9.1 | STUB | `/pharmacy/invoices/page.tsx` calls `GET /invoices` which does NOT exist → 404. No invoice list endpoint. |
| P9.2 | PARTIAL | InvoiceDetailView + InvoicePDFView exist; PDF uses reportlab; frontend has no detail page |
| P9.3 | PARTIAL | PaymentStatusView exists with transitions; frontend has no payment update UI |
| P9.4 | PARTIAL | PDF uses reportlab with Unicode support; need to verify Hindi/Marathi rendering |
| P9.5 | PARTIAL | InvoiceDetailView checks pharmacy ownership; patient can view their own |
| P10.1 | PARTIAL | NotificationListView exists; frontend notifications page shows list; mark read/all read exist |
| P10.2 | PARTIAL | Notifications created for quotation_submitted, etc.; low stock/expiry notifications not verified |
| P10.3 | PARTIAL | Notifications have no link field in response; frontend doesn't link to relevant pages |
| P11.1 | PARTIAL | Flat design tokens exist; shared components exist; pharmacy pages use them |
| P11.2 | PARTIAL | Responsive layout with Tailwind breakpoints; not tested at 360px |
| P11.3 | PARTIAL | Loading/empty/error states exist on most pages; some missing |
| P11.4 | PARTIAL | Labelled inputs, visible focus; keyboard-only not verified |
| P11.5 | PARTIAL | Dates not consistently DD MMM YYYY; amounts not consistently ₹ with 2 decimals |
| P11.6 | PARTIAL | Some actions have confirmation; not all |
| P11.7 | MISSING | Not verified — no console check done |
| P12.1 | PARTIAL | Backend permissions enforce pharmacy scoping; not verified with tests |
| P12.2 | PARTIAL | Share inactive check exists; not verified with tests |
| P12.3 | PARTIAL | IsVerifiedPharmacy permission exists; not verified with tests |
| P12.4 | PARTIAL | Redacted prescription view limits patient info; need to verify no phone/address |
| P12.5 | PARTIAL | Purchase price only in BatchSerializer; not in inventory item list for other roles |
| P12.6 | PARTIAL | Share token verification throttled (ShareTokenThrottle); not verified |
| P12.7 | PARTIAL | Backend validates prices/quantities; not verified with tests |
| P12.8 | PARTIAL | Stock movements atomic; not verified with tests |
| P12.9 | PARTIAL | CSRF header on all unsafe requests; no patient data in URLs beyond ids |

## Backend Gaps (NEEDS BACKEND)

1. No pharmacy dashboard endpoint
2. No invoice list endpoint
3. No pharmacy order list endpoint (OrderListView is IsPatient only)
4. PharmacyProfile model missing: phone, opening_hours, contact_person, default_pickup_fee, default_validity_days, pin_code
5. No stock adjustment endpoint
6. No stock ledger read endpoint
7. No expired batch write-off endpoint
8. No quotation withdraw endpoint
9. No pickup code check endpoint
10. No quotation detail endpoint for pharmacy (QuotationDetailView is generic)

## Frontend Gaps (MISSING/STUB)

1. Inventory detail page — no batch management UI, no stock adjustment, no ledger view
2. Request detail page — no redacted prescription view, no inventory match, no banners
3. Quotation builder — no UI to create quotations
4. Quotation detail — no revise, history, selected/expired states
5. Order detail — no fulfill, cancel, FEFO batch display, pickup code check
6. Invoice detail — no PDF download, payment status updates
7. Verification banner — no banner for unverified pharmacies
8. Dashboard counts — no server-side aggregation; frontend calls non-existent endpoint
9. Notifications links — no link to relevant pages

## Summary Counts

- **DONE**: 6
- **PARTIAL**: 42
- **STUB**: 5
- **MISSING**: 12
- **NEEDS BACKEND**: 10

Total Tier A items audited: 71 (P0.1-P12.9)