import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_patient_code_required'),
        ('prescriptions', '0004_prescriptionshare_idx_rxshare_stat_exp'),
    ]

    operations = [
        migrations.CreateModel(
            name='Visit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('complaint', models.CharField(blank=True, max_length=200)),
                ('diagnosis', models.CharField(blank=True, max_length=200)),
                ('private_notes', models.TextField(blank=True)),
                ('visited_at', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('doctor', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='visits', to='accounts.doctorprofile')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='accounts.patientprofile')),
                ('prescription', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='visits', to='prescriptions.prescription')),
            ],
            options={
                'ordering': ['-visited_at', '-id'],
                'indexes': [
                    models.Index(fields=['patient', 'visited_at'], name='idx_visit_patient_date'),
                ],
            },
        ),
    ]
