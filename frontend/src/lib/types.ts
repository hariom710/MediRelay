// Shared TypeScript types for API responses — no `any`

export interface Me {
  id: number;
  email: string;
  name?: string;
  roles: string[];
  active_role: string;
  verification_status: string | null;
  must_change_password?: boolean;
  patient_code?: string | null;
}

export interface Patient {
  id: number;
  name: string;
  email: string;
  phone?: string;
  date_of_birth: string | null;
  gender: string;
  blood_group: string;
  allergies: string;
  patient_code?: string;
  chronic_conditions?: string;
  is_claimed?: boolean;
  active_access?: {
    scope: "basic" | "full";
    expires_at: string;
    granted_via: string;
  } | null;
}

export interface MaskedPatientSearchResult {
  id: number;
  name: string;
  patient_code: string;
  age: number | null;
  gender: string;
  phone_masked: string;
  has_active_access: boolean;
  access_scope: "basic" | "full" | null;
  access_status: "granted" | "requested" | "none";
}

export interface CareAccess {
  id: number;
  doctor: number;
  doctor_name: string;
  doctor_registration?: string;
  patient: number;
  patient_name: string;
  patient_code: string;
  scope: "basic" | "full";
  status: "requested" | "granted" | "revoked" | "expired" | "denied";
  granted_via: "request" | "in_person_code" | "registration";
  requested_at: string;
  granted_at: string | null;
  expires_at: string;
  revoked_at: string | null;
}

export interface PatientAccessCode {
  code: string;
  expires_at: string;
  scope: "basic" | "full";
  duration_minutes: number;
}

export interface ClinicalSummary {
  allergies: string;
  chronic_conditions: string;
  active_medications: {
    medicine_name: string;
    strength: string;
    dosage_form: string;
    instructions: string;
    prescribed_by: string;
    valid_until: string | null;
  }[];
}

export interface ClinicalVisit {
  id: number;
  patient: number;
  doctor: number;
  doctor_name: string;
  chief_complaint: string;
  diagnosis: string;
  private_notes?: string;
  visit_date: string;
  prescription_id?: number | null;
}

export interface PatientTimelineEvent {
  type: "visit" | "prescription" | "purchase";
  date: string;
  doctor_name?: string;
  pharmacy_name?: string;
  title: string;
  description: string;
  id: number;
  details?: Record<string, unknown>;
}

export interface PatientHandoverSlip {
  patient_id: number;
  patient_code: string;
  name: string;
  email: string;
  temp_password?: string;
  expires_at: string;
  must_change_password: boolean;
  access_scope: string;
  login_url: string;
}

export interface AccessAuditLog {
  id: number;
  timestamp: string;
  actor_name: string;
  actor_email: string;
  action: string;
  metadata: Record<string, unknown>;
}

export interface Medicine {
  id: number;
  display_name: string;
  generic_name: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  pack_size: number;
  pack_unit: string;
}

export interface RxItem {
  id: number | null;
  medicine: number;
  medicine_name: string;
  strength: string;
  dosage_form: string;
  qty_per_dose: number;
  morning: number;
  afternoon: number;
  night: number;
  meal_timing: string;
  duration_days: number;
  total_qty: number;
  calculated_qty: number;
  instructions: string;
  sort_order: number;
}

export interface Prescription {
  id: number;
  status: string;
  version: number;
  previous_version: number | null;
  consultation_date: string;
  valid_until: string | null;
  is_expired: boolean;
  notes: string;
  signed_at: string | null;
  patient: number;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  items: RxItem[];
}

export interface InventoryItem {
  id: number;
  medicine: number;
  medicine_name: string;
  dosage_form?: string;
  strength?: string;
  selling_price: string;
  available_qty: number;
  batches: Batch[];
}

export interface Batch {
  id: number;
  batch_number: string;
  expiry_date: string;
  qty: number;
  mrp: string;
  purchase_price: string;
  status: string;
  is_expired: boolean;
}

export interface Quotation {
  id: number;
  prescription: number;
  status: string;
  total: string;
  validity: string;
  revision: number;
  created_at: string;
}

export interface Order {
  id: number;
  status: string;
  patient_name: string;
  item_count: number;
  subtotal: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  order: number;
  patient: string;
  total: string;
  payment_status: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface PharmacyProfile {
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

export interface DoctorProfile {
  id: number;
  qualification: string;
  registration_number: string;
  clinic_name: string;
  verification_status: string;
  verification_note: string;
}

export interface Request {
  share_id: number;
  prescription_id: number;
  opened: boolean;
  expires_at: string;
  status?: string;
}

export interface Dashboard {
  new_requests: number;
  quotations_awaiting: number;
  orders_to_fulfill: number;
  low_stock: number;
  expiring_soon: number;
  recent_requests: { prescription_id: number; share_id: number; opened: boolean; expires_at: string }[];
  recent_orders: { id: number; status: string; subtotal: string; created_at: string }[];
}