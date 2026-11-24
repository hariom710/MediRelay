#!/usr/bin/env python
import os, sys
sys.path.insert(0, 'D:\\\\projets\\\\MediRelay\\\\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
import django
django.setup()
from django.db import connection

# Verify all 21 tables exist
with connection.cursor() as cursor:
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
    tables = [row[0] for row in cursor.fetchall()]

expected_tables = [
    'accounts_user', 'accounts_role', 'audit_auditlog', 'audit_prescriptionaccesslog',
    'catalog_medicine', 'inventory_inventoryitem', 'inventory_medicinebatch', 'inventory_stockmovement',
    'notifications_notification', 'orders_order', 'orders_orderfulfillment', 'orders_orderitem', 'orders_invoice',
    'prescriptions_prescription', 'prescriptions_prescriptionitem', 'prescriptions_prescriptionshare',
    'quotations_quotation', 'quotations_quotationitem'
]

print("Database tables found:", len(tables))
print("Expected tables:", len(expected_tables))
print()
for t in expected_tables:
    status = "FOUND" if t in tables else "MISSING"
    print(f"  {t}: {status}")

# Check for unexpected tables
for t in tables:
    if t not in expected_tables:
        print(f"  UNEXPECTED: {t}")