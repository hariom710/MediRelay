with open(r'D:\projets\MediRelay\backend\accounts\views.py', 'r') as f:
    content = f.read()
print('DoctorDashboardView exists:', 'DoctorDashboardView' in content)
print('PharmacyDashboardView exists:', 'PharmacyDashboardView' in content)
