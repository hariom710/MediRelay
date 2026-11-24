"""
Conftest.py for MediRelay tests.

This file is loaded by pytest before any test module.
It ensures production settings are used when running production config tests.
"""

import os

# Override the default Django settings module for production config tests
# This is executed before pytest.ini's DJANGO_SETTINGS_MODULE
if os.environ.get('PYTEST_PRODUCTION_CONFIG', '').lower() == '1':
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.production'