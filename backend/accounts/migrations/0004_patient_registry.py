"""Universal patient registry: identity fields, consent, one-time codes."""

import re
import secrets
from datetime import timedelta

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _normalize_phone(raw):
    digits = re.sub(r'\D', '', raw or '')
    return digits[-10:] if len(digits) >= 10 else digits


def _normalize_name(raw):
    return re.sub(r'[^a-z]', '', (raw or '').lower())


def backfill(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    PatientProfile = apps.get_model('accounts', 'PatientProfile')
    DoctorProfile = apps.get_model('accounts', 'DoctorProfile')
    CareAccess = apps.get_model('accounts', 'CareAccess')

    used = set(
        PatientProfile.objects.exclude(patient_code=None)
        .exclude(patient_code='').values_list('patient_code', flat=True)
    )

    for profile in PatientProfile.objects.select_related('user'):
        code = profile.patient_code
        if not code:
            for _ in range(20):
                candidate = 'MR-' + ''.join(secrets.choice(CODE_ALPHABET) for _ in range(6))
                if candidate not in used:
                    code = candidate
                    break
            used.add(code)
        email = (profile.user.email or '').lower()
        PatientProfile.objects.filter(pk=profile.pk).update(
            patient_code=code,
            phone_normalized=_normalize_phone(profile.user.phone),
            is_claimed=not email.endswith('@medirelay.local'),
        )

    now = django.utils.timezone.now()
    for profile in PatientProfile.objects.select_related('created_by'):
        creator = profile.created_by
        if creator is None:
            continue
        doctor = DoctorProfile.objects.filter(user_id=creator.id).first()
        if doctor is None:
            continue
        CareAccess.objects.get_or_create(
            doctor=doctor, patient=profile,
            defaults={
                'scope': 'full',
                'status': 'active',
                'granted_via': 'legacy',
                'granted_at': now,
                'expires_at': now + timedelta(days=365),
            },
        )

    # Duplicate report: counts and numeric ids only, never personal data.
    groups = {}
    for profile in PatientProfile.objects.select_related('user'):
        if not profile.phone_normalized or not profile.date_of_birth:
            continue
        key = (profile.phone_normalized, profile.date_of_birth)
        groups.setdefault(key, []).append(profile.id)
    dup_ids = sorted(pid for ids in groups.values() if len(ids) > 1 for pid in ids)
    if dup_ids:
        print(f'[patient-registry] possible duplicate profiles: {len(dup_ids)} '
              f'(phone+DOB), ids={dup_ids}')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_pharmacyprofile_contact_person_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patientprofile',
            name='chronic_conditions',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='patientprofile',
            name='is_claimed',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='patientprofile',
            name='patient_code',
            field=models.CharField(editable=False, max_length=12, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='patientprofile',
            name='phone_normalized',
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.CreateModel(
            name='CareAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('basic', 'Basic'), ('full', 'Full')], default='basic', max_length=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('denied', 'Denied'), ('revoked', 'Revoked'), ('expired', 'Expired')], default='pending', max_length=20)),
                ('granted_via', models.CharField(blank=True, choices=[('patient_approved', 'Patient approved'), ('one_time_code', 'One-time code'), ('legacy', 'Legacy import')], max_length=20)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('granted_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('doctor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='care_access', to='accounts.doctorprofile')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='care_access', to='accounts.patientprofile')),
            ],
            options={
                'unique_together': {('doctor', 'patient')},
                'indexes': [
                    models.Index(fields=['patient', 'status'], name='idx_access_patient_status'),
                    models.Index(fields=['doctor', 'status'], name='idx_access_doctor_status'),
                ],
            },
        ),
        migrations.CreateModel(
            name='PatientAccessCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code_hash', models.CharField(max_length=64)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_codes', to='accounts.patientprofile')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['patient', 'expires_at'], name='idx_code_patient_exp'),
                ],
            },
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
