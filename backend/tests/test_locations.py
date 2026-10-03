"""Unit tests for the saved-location validation (dental/locations.py).

Pure tests — no firebase_admin, no network.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

from dental.locations import STATE_CODES, validate_location


def test_state_codes_are_the_50_states_plus_dc():
    assert len(STATE_CODES) == 51
    assert "DC" in STATE_CODES
    assert "PR" not in STATE_CODES


def test_state_and_matching_zip_are_valid():
    assert validate_location("TX", "78701") == ("TX", "78701")


def test_zip_is_optional():
    assert validate_location("PA", None) == ("PA", None)


def test_empty_zip_means_no_zip():
    assert validate_location("PA", "") == ("PA", None)


@pytest.mark.parametrize("state", [None, "", "XX", "tx", "Texas", 42])
def test_unknown_state_is_rejected(state):
    with pytest.raises(ValueError, match="state"):
        validate_location(state, None)


@pytest.mark.parametrize("zip_code", ["7870", "787011", "78a01", 78701])
def test_badly_formatted_zip_is_rejected(zip_code):
    with pytest.raises(ValueError, match="5-digit"):
        validate_location("TX", zip_code)


def test_zip_from_another_state_is_rejected():
    # 100xx is New York.
    with pytest.raises(ValueError, match="not TX"):
        validate_location("TX", "10001")


def test_zip_prefix_no_state_claims_is_allowed():
    # 006xx is Puerto Rico, which no state in the table claims.
    assert validate_location("TX", "00601") == ("TX", "00601")


def test_zip_prefix_shared_across_a_border_fits_either_state():
    # 834xx is listed under both ID and WY.
    assert validate_location("ID", "83414") == ("ID", "83414")
    assert validate_location("WY", "83414") == ("WY", "83414")
