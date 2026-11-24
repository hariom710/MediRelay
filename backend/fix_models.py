#!/usr/bin/env python
import os

# Read the inventory models file
with open('D:\projets\MediRelay\backend/inventory/models.py', 'r') as f:
    content = f.read()

# Add indexes to InventoryItem Meta
inventoryitem_meta_old = """    class Meta:
        unique_together = [('pharmacy', 'medicine')]
        ordering = ['medicine__generic_name']"""

inventoryitem_meta_new = """    class Meta:
        unique_together = [('pharmacy', 'medicine')]
        ordering = ['medicine__generic_name']
        indexes = [
            models.Index(fields=['medicine'], name='idx_inventoryitem_medicine'),
            models.Index(fields=['pharmacy', 'medicine'], name='idx_inventoryitem_pharm_med'),
        ]"""

content = content.replace(inventoryitem_meta_old, inventoryitem_meta_new)

# Add indexes to MedicineBatch Meta
medbatch_meta_old = """    class Meta:
        unique_together = [('inventory_item', 'batch_number')]
        ordering = ['expiry_date']  # FEFO: first expiry first out"""

medbatch_meta_new = """    class Meta:
        unique_together = [('inventory_item', 'batch_number')]
        ordering = ['expiry_date']  # FEFO: first expiry first out
        indexes = [
            models.Index(fields=['inventory_item'], name='idx_medicinebatch_inventory'),
            models.Index(fields=['inventory_item', 'status'], name='idx_medicinebatch_inv_status'),
        ]"""

content = content.replace(medbatch_meta_old, medbatch_meta_new)

with open('D:\projets\MediRelay\backend/inventory/models.py', 'w') as f:
    f.write(content)

print('inventory/models.py updated')