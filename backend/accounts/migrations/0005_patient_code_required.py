from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_patient_registry'),
    ]

    operations = [
        migrations.AlterField(
            model_name='patientprofile',
            name='patient_code',
            field=models.CharField(editable=False, max_length=12, unique=True),
        ),
    ]
