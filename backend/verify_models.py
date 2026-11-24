#!/usr/bin/env python
import os, sys
sys.path.insert(0, 'D:\\projets\\MediRelay\\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
import django
django.setup()
from inventory.models import InventoryItem, MedicineBatch
from orders.models import OrderFulfillment
from prescriptions.models import PrescriptionShare
print('All models import OK')