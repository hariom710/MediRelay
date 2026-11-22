"""Comparison engine tests — uses the worked example from the spec."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from quotations.engine import compare

from .helpers import (build_prescription, quote_from, set_stock)

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_cheapest_complete_picks_single_covering_pharmacy(client, doctor, patient,
                                                          pharmacy, pharmacy2,
                                                          medicine, medicine2):
    """Spec example shape: A dearer, B cheaper, both complete -> B wins."""
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])

    quote_from(pharmacy, rx, {medicine.id: (85, 10), medicine2.id: (100, 10)},
               pickup_fee=0)
    quote_from(pharmacy2, rx, {medicine.id: (79, 10), medicine2.id: (100, 10)},
               pickup_fee=0)

    result = compare(rx, 'cheapest_complete')
    assert len(result['options']) == 2
    assert result['options'][0]['pharmacy_ids'] == [pharmacy2.pharmacy_profile.id]
    # 790 + 1000 — pack rounding is a no-op when qty is already a pack multiple
    assert Decimal(result['options'][0]['grand_total']) == Decimal('1790.00')


def test_incomplete_pharmacy_excluded_from_complete_mode(client, doctor, patient,
                                                         pharmacy, medicine, medicine2):
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 15)])
    # pharmacy has only medicine 1
    quote_from(pharmacy, rx, {medicine.id: (85, 10)}, pickup_fee=0)

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_combination_beats_single_when_split_is_cheaper(client, doctor, patient,
                                                        pharmacy, pharmacy2,
                                                        medicine, medicine2):
    """P1 covers both but expensive; P2 covers only m2 cheaply -> split wins."""
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])

    # pharmacy1: both items, expensive on medicine2
    quote_from(pharmacy, rx, {medicine.id: (100, 10), medicine2.id: (200, 10)},
               pickup_fee=0)
    # pharmacy2: only medicine2, cheap
    quote_from(pharmacy2, rx, {medicine2.id: (70, 10)}, pickup_fee=0)

    result = compare(rx, 'cheapest_combination')
    assert result['options'], 'combination mode must find an option'
    best = result['options'][0]
    # 1000 + 700 = 1700 (unit prices × 10 units each) beats P1 alone at 3000
    assert Decimal(best['grand_total']) == Decimal('1700.00')
    assert sorted(best['pharmacy_ids']) == sorted(
        [pharmacy.pharmacy_profile.id, pharmacy2.pharmacy_profile.id])


def test_pickup_fee_included_in_total(client, doctor, patient, pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=40)

    result = compare(rx, 'cheapest_complete')
    opt = result['options'][0]
    assert Decimal(opt['fees_total']) == Decimal('40.00')
    assert Decimal(opt['grand_total']) == Decimal('1040.00')


def test_pack_size_rounding_charges_whole_packs(client, doctor, patient, pharmacy,
                                                medicine):
    """Need 7, pack of 10 -> charged for 10."""
    rx = build_prescription(doctor, patient, [(medicine, 7)])
    # pack_size=10 on fixture medicine; pharmacy offers 10 at Rs 10 each
    quote_from(pharmacy, rx, {medicine.id: (10, 10)}, pickup_fee=0)

    result = compare(rx, 'cheapest_complete')
    opt = result['options'][0]
    assert Decimal(opt['grand_total']) == Decimal('100.00')  # 10 tablets × 10


def test_substituted_medicine_not_auto_eligible(client, doctor, patient, pharmacy,
                                                medicine, medicine2):
    """Pharmacy offers medicine2 as a stand-in for medicine — engine must ignore it."""
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=0,
               offered={medicine.id: medicine2.id})  # substitution!

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_expired_quotation_excluded(client, doctor, patient, pharmacy, medicine):
    from django.utils import timezone
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote = quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=0)
    quote.valid_until = timezone.now() - timezone.timedelta(hours=1)
    quote.save()

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_draft_quotation_not_included(client, doctor, patient, pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=0, submit=False)

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_unavailable_item_excluded(client, doctor, patient, pharmacy, medicine,
                                   medicine2):
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10), medicine2.id: (50, 10)},
               pickup_fee=0, unavailable={medicine2.id})

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_insufficient_qty_offered_excluded(client, doctor, patient, pharmacy,
                                           medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    # offers only 5 of the 10 required
    quote_from(pharmacy, rx, {medicine.id: (100, 5)}, pickup_fee=0)

    result = compare(rx, 'cheapest_complete')
    assert result['options'] == []


def test_fewest_pharmacies_mode_ranks_by_count(client, doctor, patient, pharmacy,
                                               pharmacy2, medicine, medicine2):
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])
    # both complete, pharmacy1 slightly dearer; pharmacy2 cheap but partial
    quote_from(pharmacy, rx, {medicine.id: (100, 10), medicine2.id: (100, 10)},
               pickup_fee=0)
    quote_from(pharmacy2, rx, {medicine2.id: (10, 10)}, pickup_fee=0)

    result = compare(rx, 'fewest_pharmacies')
    assert result['options'][0]['pharmacy_count'] == 1
    # the single-pharmacy option is the complete one (P1)
    assert result['options'][0]['pharmacy_ids'] == [pharmacy.pharmacy_profile.id]
