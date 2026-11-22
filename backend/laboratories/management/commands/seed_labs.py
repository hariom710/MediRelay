from django.core.management.base import BaseCommand
from accounts.models import User, Role, PatientProfile
from laboratories.models import LaboratoryProfile, DiagnosticTest


class Command(BaseCommand):
    help = "Seed initial diagnostic laboratory and test catalogue"

    def handle(self, *args, **options):
        # Create Lab User
        lab_user, _ = User.objects.get_or_create(
            email="citypathology@example.com",
            defaults={"first_name": "City", "last_name": "Diagnostics"}
        )
        lab_user.set_password("password123")
        lab_user.save()

        lab_profile, _ = LaboratoryProfile.objects.get_or_create(
            user=lab_user,
            defaults={
                "lab_name": "City Pathology & Imaging Centre",
                "registration_number": "NABL-98741",
                "address": "42 Healthway Boulevard, Suite 10",
                "city": "Mumbai",
                "offers_home_collection": True,
                "verification_status": "verified",
            }
        )

        tests = [
            ("Complete Blood Count (CBC)", "CBC01", "Measures red cells, white cells, hemoglobin, and platelets.", "350.00", 12),
            ("Thyroid Profile (T3, T4, TSH)", "THY01", "Comprehensive evaluation of thyroid gland functioning.", "600.00", 24),
            ("Lipid Profile", "LIP01", "Total cholesterol, HDL, LDL, and triglycerides.", "550.00", 18),
            ("HbA1c (Glycated Hemoglobin)", "HBA01", "3-month average blood sugar assessment.", "450.00", 12),
            ("Liver Function Test (LFT)", "LFT01", "SGOT, SGPT, bilirubin, and liver enzyme profile.", "700.00", 24),
            ("Kidney Function Test (KFT)", "KFT01", "Urea, creatinine, and electrolytes.", "650.00", 24),
        ]

        for name, code, desc, price, hours in tests:
            DiagnosticTest.objects.get_or_create(
                laboratory=lab_profile,
                test_name=name,
                defaults={
                    "test_code": code,
                    "description": desc,
                    "price": price,
                    "turnaround_hours": hours,
                    "is_available": True,
                }
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded laboratory and diagnostic test catalogue."))
