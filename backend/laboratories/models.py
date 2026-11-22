from django.db import models
from accounts.models import User, PatientProfile, VerificationStatus, VerificationStateMachineMixin
from config.state_machine import StateMachineMixin


class LabBookingStatus(models.TextChoices):
    PENDING = 'pending', 'Pending Confirmation'
    CONFIRMED = 'confirmed', 'Confirmed'
    SAMPLE_COLLECTED = 'sample_collected', 'Sample Collected'
    REPORT_READY = 'report_ready', 'Report Ready'
    CANCELLED = 'cancelled', 'Cancelled'


class LaboratoryProfile(VerificationStateMachineMixin, models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='laboratory_profile')
    lab_name = models.CharField(max_length=200)
    registration_number = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    offers_home_collection = models.BooleanField(default=True)
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.lab_name


class DiagnosticTest(models.Model):
    laboratory = models.ForeignKey(LaboratoryProfile, on_delete=models.CASCADE, related_name='tests')
    test_name = models.CharField(max_length=200)  # e.g., 'Complete Blood Count (CBC)', 'Thyroid Profile (TSH)'
    test_code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    turnaround_hours = models.PositiveIntegerField(default=24)
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.test_name} - {self.laboratory.lab_name}"


class LabBooking(StateMachineMixin, models.Model):
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='lab_bookings')
    test = models.ForeignKey(DiagnosticTest, on_delete=models.CASCADE, related_name='bookings')
    scheduled_date = models.DateField()
    scheduled_time = models.CharField(max_length=50, default='Morning (08:00 AM - 11:00 AM)')
    home_collection = models.BooleanField(default=False)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=LabBookingStatus.choices, default=LabBookingStatus.CONFIRMED)

    TRANSITIONS = {
        LabBookingStatus.PENDING: [LabBookingStatus.CONFIRMED, LabBookingStatus.CANCELLED],
        LabBookingStatus.CONFIRMED: [LabBookingStatus.SAMPLE_COLLECTED, LabBookingStatus.CANCELLED],
        LabBookingStatus.SAMPLE_COLLECTED: [LabBookingStatus.REPORT_READY, LabBookingStatus.CANCELLED],
        LabBookingStatus.REPORT_READY: [],
        LabBookingStatus.CANCELLED: [],
    }
    report_file_url = models.CharField(max_length=500, blank=True)
    report_summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking #{self.id} for {self.test.test_name}"
