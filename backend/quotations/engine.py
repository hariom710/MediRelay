"""Price comparison engine.

Deterministic, pure functions over quotations. Two algorithms:
  1. cheapest_complete — one pharmacy covers every required item
  2. cheapest_combination — brute force over pharmacy subsets (exact at our scale)

shortcut: combination search is O(2^P) over pharmacies — exact and instant for
the ≤15 pharmacies that realistically quote one prescription; switch to a solver
(ILP/OR-Tools) if that ever grows.
"""

from decimal import Decimal
from math import ceil

from django.utils import timezone

from prescriptions.models import PrescriptionItem

from .models import QuotationItem, QuotationStatus

ZERO = Decimal('0')
ELIGIBLE_STATUSES = (QuotationStatus.SUBMITTED, QuotationStatus.VIEWED)


def _line_cost(qi: QuotationItem) -> tuple[Decimal, int]:
    """Cost of covering one prescription line at this pharmacy.
    Pack-size rounding: you buy whole packs, not loose tablets."""
    required = int(qi.prescription_item.total_qty)
    pack = qi.offered_medicine.pack_size or 1 if qi.offered_medicine_id \
        else qi.prescription_item.medicine.pack_size or 1
    packs = max(1, ceil(required / pack))
    charged_qty = packs * pack
    return qi.unit_price * charged_qty, charged_qty


def _eligible_items(rx_items, pharmacy_ids) -> dict:
    """pharmacy_id -> {prescription_item_id: (qi, cost, charged_qty)}"""
    now = timezone.now()
    qs = (QuotationItem.objects
          .filter(quotation__status__in=ELIGIBLE_STATUSES,
                  quotation__valid_until__gte=now,
                  quotation__pharmacy__verification_status='verified',
                  quotation__pharmacy_id__in=pharmacy_ids,
                  available=True,
                  prescription_item__in=rx_items)
          .select_related('quotation', 'prescription_item',
                          'prescription_item__medicine', 'offered_medicine'))
    by_pharmacy: dict = {}
    for qi in qs:
        # stock must cover the charged (pack-rounded) quantity
        if qi.qty_offered < _line_cost(qi)[1]:
            continue
        # substitution guard: only the prescribed medicine counts automatically
        if qi.offered_medicine_id and \
                qi.offered_medicine_id != qi.prescription_item.medicine_id:
            continue
        cost, charged = _line_cost(qi)
        by_pharmacy.setdefault(qi.quotation.pharmacy_id, {})[qi.prescription_item_id] = \
            (qi, cost, charged)
    return by_pharmacy


def _pickup_fee(pharmacy_id, quotation_map) -> Decimal:
    q = quotation_map.get(pharmacy_id)
    return q.pickup_fee if q else ZERO


def compare(prescription, mode: str) -> dict:
    """mode: cheapest_complete | cheapest_combination | fewest_pharmacies"""
    rx_items = list(prescription.items.all())
    if not rx_items:
        return {'mode': mode, 'options': [], 'error': 'prescription has no items'}
    item_ids = [i.id for i in rx_items]

    quotation_map = {q.pharmacy_id: q for q in
                     prescription.quotations.filter(
                         status__in=ELIGIBLE_STATUSES,
                         valid_until__gte=timezone.now(),
                         pharmacy__verification_status='verified')}
    pharmacy_ids = list(quotation_map.keys())
    if not pharmacy_ids:
        return {'mode': mode, 'options': []}

    by_pharmacy = _eligible_items(rx_items, pharmacy_ids)
    # a pharmacy can only be in a combination if it covers >=1 required item
    candidates = [p for p in pharmacy_ids if by_pharmacy.get(p)]

    complete_singles = []
    for pid in candidates:
        covered = by_pharmacy[pid]
        if all(iid in covered for iid in item_ids):
            medicine_total = sum((covered[iid][1] for iid in item_ids), ZERO)
            complete_singles.append(_option(
                [pid], {iid: (pid, covered[iid]) for iid in item_ids},
                medicine_total, quotation_map))

    if mode == 'cheapest_complete':
        complete_singles.sort(key=lambda o: Decimal(o['grand_total']))
        return {'mode': mode, 'options': complete_singles}

    # combination: try every non-empty subset of candidate pharmacies
    best: dict[int, dict] = {}  # frozenset -> option
    n = len(candidates)
    for mask in range(1, 1 << n):
        subset = [candidates[i] for i in range(n) if mask & (1 << i)]
        assignment, medicine_total, ok = {}, ZERO, True
        for iid in item_ids:
            best_for_item = None
            for pid in subset:
                entry = by_pharmacy[pid].get(iid)
                if entry and (best_for_item is None or entry[1] < best_for_item[1]):
                    best_for_item = entry
                    best_pid = pid
            if best_for_item is None:
                ok = False
                break
            assignment[iid] = (best_pid, best_for_item)
            medicine_total += best_for_item[1]
        if not ok:
            continue
        key = frozenset(assignment.values())
        opt = _option(sorted({p for p, _ in assignment.values()}),
                      assignment, medicine_total, quotation_map)
        if key not in best or Decimal(opt['grand_total']) < Decimal(best[key]['grand_total']):
            best[key] = opt

    options = list(best.values())
    # dedupe: keep options with distinct pharmacy sets and item assignments
    if mode == 'fewest_pharmacies':
        options.sort(key=lambda o: (o['pharmacy_count'], Decimal(o['grand_total'])))
    else:  # cheapest_combination
        options.sort(key=lambda o: Decimal(o['grand_total']))
    # drop dominated rows: same pharmacies, higher total
    seen, deduped = set(), []
    for o in options:
        sig = (tuple(o['pharmacy_ids']), str(o['grand_total']))
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(o)
    return {'mode': mode, 'options': deduped[:10]}


def _option(pharmacy_ids, assignment, medicine_total, quotation_map) -> dict:
    lines = []
    by_pharmacy: dict = {}
    for iid, (pid, entry) in assignment.items():
        qi, cost, charged = entry
        row = {
            'prescription_item_id': iid,
            'pharmacy_id': pid,
            'pharmacy_name': quotation_map[pid].pharmacy.pharmacy_name,
            'medicine': qi.prescription_item.medicine.display_name,
            'required_qty': str(qi.prescription_item.total_qty),
            'charged_qty': charged,
            'unit_price': str(qi.unit_price),
            'line_total': str(cost),
        }
        lines.append(row)
        by_pharmacy.setdefault(pid, []).append(row)

    fulfillments = []
    total_fee = ZERO
    for pid in sorted(by_pharmacy):
        fee_amt = _pickup_fee(pid, quotation_map)
        total_fee += fee_amt
        subtotal = sum((Decimal(l['line_total']) for l in by_pharmacy[pid]), ZERO)
        fulfillments.append({
            'pharmacy_id': pid,
            'pharmacy_name': quotation_map[pid].pharmacy.pharmacy_name,
            'pickup_fee': str(fee_amt),
            'subtotal': str(subtotal + fee_amt),
            'lines': by_pharmacy[pid],
        })

    return {
        'pharmacy_ids': sorted(pharmacy_ids),
        'pharmacy_count': len(pharmacy_ids),
        'medicine_total': str(medicine_total),
        'fees_total': str(total_fee),
        'grand_total': str(medicine_total + total_fee),
        'lines': lines,
        'fulfillments': fulfillments,
    }
