from django.db import models
from accounts.models import User, PatientProfile


class MedicalDocument(models.Model):
    DOCUMENT_TYPES = [
        ('prescription', 'Prescription'),
        ('blood_report', 'Blood Test / CBC'),
        ('imaging', 'X-Ray / MRI / CT Scan'),
        ('discharge_summary', 'Discharge Summary'),
        ('invoice', 'Pharmacy Invoice'),
        ('other', 'Other Medical Document'),
    ]

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='medical_documents')
    title = models.CharField(max_length=200)
    document_type = models.CharField(max_length=40, choices=DOCUMENT_TYPES, default='other')
    file_url = models.CharField(max_length=500, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.document_type})"


class FamilyMember(models.Model):
    RELATIONSHIPS = [
        ('spouse', 'Spouse'),
        ('child', 'Child'),
        ('parent', 'Parent'),
        ('sibling', 'Sibling'),
        ('other', 'Other'),
    ]

    primary_patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='family_members')
    full_name = models.CharField(max_length=120)
    relationship = models.CharField(max_length=30, choices=RELATIONSHIPS)
    date_of_birth = models.DateField(null=True, blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    allergies = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.full_name} ({self.relationship})"


class MedicationReminder(models.Model):
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='reminders')
    medicine_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, default='1 unit')
    timing = models.CharField(max_length=100, default='08:00 AM')  # e.g., '08:00 AM', '02:00 PM', '08:00 PM'
    meal_relation = models.CharField(max_length=50, default='after_food')
    is_active = models.BooleanField(default=True)
    last_taken_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.medicine_name} at {self.timing}"
