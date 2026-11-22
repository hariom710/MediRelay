"""PDF generation with fpdf2. Uses a system TTF when present so ₹ renders;
falls back to core Helvetica (latin-1) with 'Rs' instead of ₹."""

from pathlib import Path

from django.http import HttpResponse
from fpdf import FPDF

FONT_CANDIDATES = [
    Path(r'C:\Windows\Fonts\arial.ttf'),
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
    Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf'),
]


def _font(pdf: FPDF) -> tuple[str, str]:
    for path in FONT_CANDIDATES:
        if path.exists():
            pdf.add_font('UI', '', str(path))
            bold = path.parent / ('arialbd.ttf' if path.name == 'arial.ttf' else path.name)
            pdf.add_font('UI', 'B', str(bold if bold.exists() else path))
            return 'UI', 'Rs'
    return 'helvetica', 'Rs'  # helvetica is latin-1: no ₹ glyph, use Rs


def _money(pdf: FPDF, amount, cur: str) -> str:
    return f'{cur} {amount:,.2f}'


def prescription_pdf(rx) -> HttpResponse:
    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    family, cur = _font(pdf)

    pdf.set_font(family, 'B', 16)
    pdf.cell(0, 10, 'MediRelay', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font(family, '', 9)
    pdf.cell(0, 5, 'Digital Prescription', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(4)

    pdf.set_font(family, 'B', 10)
    pdf.cell(0, 6, f'RX-{rx.pk}  v{rx.version}  ({rx.status.upper()})',
             new_x='LMARGIN', new_y='NEXT')
    pdf.set_font(family, '', 10)
    doctor = rx.doctor.user
    patient = rx.patient.user
    rows = [
        ('Doctor', f'{doctor.get_full_name() or doctor.email}'
                   f'{", " + rx.doctor.qualification if rx.doctor.qualification else ""}'),
        ('Reg. No.', rx.doctor.registration_number or '-'),
        ('Patient', f'{patient.get_full_name() or patient.email}'
                    f'{f", {age}y" if (age := _age(rx)) else ""}'),
        ('Consultation date', rx.consultation_date.strftime('%d %b %Y')),
        ('Allergies', rx.patient.allergies.strip() or 'None recorded'),
    ]
    for label, value in rows:
        pdf.set_font(family, 'B', 10)
        pdf.cell(35, 6, label)
        pdf.set_font(family, '', 10)
        pdf.multi_cell(0, 6, str(value), new_x='LMARGIN', new_y='NEXT')

    pdf.ln(4)
    pdf.set_draw_color(60, 60, 60)
    for item in rx.items.all():
        pdf.set_font(family, 'B', 11)
        pdf.multi_cell(0, 6,
                       f'{item.medicine.display_name} — {item.strength or item.medicine.strength}',
                       new_x='LMARGIN', new_y='NEXT')
        pdf.set_font(family, '', 10)
        sig = (f'Morning {item.morning} | Afternoon {item.afternoon} | Night {item.night}'
               f' | {item.get_meal_timing_display()} | {item.duration_days} days'
               f' | Qty {item.total_qty}')
        pdf.multi_cell(0, 5, sig, new_x='LMARGIN', new_y='NEXT')
        if item.instructions:
            pdf.multi_cell(0, 5, f'Note: {item.instructions}', new_x='LMARGIN', new_y='NEXT')
        pdf.ln(2)

    if rx.notes:
        pdf.ln(2)
        pdf.set_font(family, 'B', 10)
        pdf.cell(0, 6, 'Notes', new_x='LMARGIN', new_y='NEXT')
        pdf.set_font(family, '', 10)
        pdf.multi_cell(0, 5, rx.notes, new_x='LMARGIN', new_y='NEXT')

    pdf.ln(10)
    pdf.set_font(family, '', 10)
    pdf.cell(0, 6, f'Signed: {rx.signed_at.strftime("%d %b %Y %H:%M") if rx.signed_at else "draft"}'
             f'    |    {doctor.get_full_name() or doctor.email}',
             align='R', new_x='LMARGIN', new_y='NEXT')

    return HttpResponse(bytes(pdf.output()), content_type='application/pdf',
                        headers={'Content-Disposition': f'inline; filename=RX-{rx.pk}.pdf'})


def invoice_pdf(invoice) -> HttpResponse:
    from decimal import Decimal
    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    family, cur = _font(pdf)
    fulfillment = invoice.fulfillment
    pharmacy = fulfillment.pharmacy
    order = fulfillment.order

    pdf.set_font(family, 'B', 16)
    pdf.cell(0, 10, pharmacy.pharmacy_name, align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font(family, '', 9)
    pdf.multi_cell(0, 5, f'{pharmacy.address}\nLicence: {pharmacy.license_number or "-"}',
                   align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(3)
    pdf.set_font(family, 'B', 11)
    pdf.cell(0, 6, f'Invoice {invoice.invoice_number}',
             new_x='LMARGIN', new_y='NEXT')
    pdf.set_font(family, '', 10)
    pdf.cell(0, 6, f'Date: {invoice.issued_at.strftime("%d %b %Y %H:%M")}'
                   f'   Order: ORD-{order.pk}',
             new_x='LMARGIN', new_y='NEXT')
    pdf.ln(3)

    # table header
    pdf.set_font(family, 'B', 10)
    widths = [70, 30, 30, 40]
    for w, h in zip(widths, ['Medicine', 'Qty', 'Unit price', 'Total']):
        pdf.cell(w, 7, h, border=1)
    pdf.ln()
    pdf.set_font(family, '', 10)
    total = Decimal('0')
    for oi in fulfillment.items.select_related('medicine'):
        line = oi.qty * oi.unit_price
        total += line
        cells = [oi.medicine.display_name[:34], str(oi.qty), f'{oi.unit_price:.2f}',
                 f'{line:.2f}']
        for w, c in zip(widths, cells):
            pdf.cell(w, 7, str(c), border=1)
        pdf.ln()
    if fulfillment.pickup_fee:
        pdf.cell(widths[0] + widths[1] + widths[2], 7, 'Pickup/delivery fee', border=1, align='R')
        pdf.cell(widths[3], 7, f'{fulfillment.pickup_fee:.2f}', border=1)
        pdf.ln()
        total += fulfillment.pickup_fee
    pdf.set_font(family, 'B', 11)
    pdf.cell(sum(widths[:3]), 9, 'Total payable', border=1, align='R')
    pdf.cell(widths[3], 9, f'{cur} {total:,.2f}', border=1)
    pdf.ln(12)
    pdf.set_font(family, '', 9)
    pdf.multi_cell(0, 5, f'Prescription: RX-{order.prescription_id}   '
                         f'Payment status: {invoice.payment_status}',
                   align='R', new_x='LMARGIN', new_y='NEXT')

    return HttpResponse(bytes(pdf.output()), content_type='application/pdf',
                        headers={'Content-Disposition': f'inline; filename={invoice.invoice_number}.pdf'})


def _age(rx) -> int | None:
    dob = rx.patient.date_of_birth
    if not dob:
        return None
    from datetime import date
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
