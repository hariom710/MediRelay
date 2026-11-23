from django.core.management.base import BaseCommand
from django.utils import timezone
from prescriptions.models import Prescription, PrescriptionShare, PrescriptionStatus, ShareStatus
from quotations.models import Quotation, QuotationStatus


class Command(BaseCommand):
    help = 'Expires stale prescriptions, quotations, and shares past their validity date.'

    def handle(self, *args, **options):
        now_date = timezone.now().date()
        now_time = timezone.now()

        # Expire stale prescriptions
        stale_rxs = Prescription.objects.filter(
            status=PrescriptionStatus.FINALIZED,
            valid_until__lt=now_date
        )
        rx_count = 0
        for rx in stale_rxs:
            rx.transition_to(PrescriptionStatus.EXPIRED, reason='Expired by expire_stale command', save=True)
            rx_count += 1

        # Expire stale quotations
        stale_quotes = Quotation.objects.filter(
            status__in=[QuotationStatus.SUBMITTED, QuotationStatus.VIEWED],
            valid_until__lt=now_time
        )
        quote_count = 0
        for q in stale_quotes:
            q.transition_to(QuotationStatus.EXPIRED, reason='Expired by expire_stale command', save=True)
            quote_count += 1

        # Expire stale shares
        stale_shares = PrescriptionShare.objects.filter(
            status=ShareStatus.ACTIVE,
            expires_at__lt=now_time
        )
        share_count = 0
        for s in stale_shares:
            s.transition_to(ShareStatus.EXPIRED, reason='Expired by expire_stale command', save=True)
            share_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Expired {rx_count} prescription(s), {quote_count} quotation(s), and {share_count} share(s).'
        ))
