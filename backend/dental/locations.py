"""Validation for the user's saved location (state + optional ZIP).

The frontend checks the same things before sending, but its checks can be
bypassed, so the backend re-checks before saving. The tables here mirror
``frontend/js/options.js`` (``STATES`` and ``ZIP_PREFIXES``); keep them in sync.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# The 50 states plus DC, as 2-letter codes.
STATE_CODES: frozenset[str] = frozenset({
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
    "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
    "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
})

# The first three digits of a ZIP code identify its state. Each state lists
# inclusive (low, high) ranges of 3-digit prefixes. Approximate, like the
# frontend table it mirrors: a prefix no state claims (territories, military)
# is never flagged, and a prefix that straddles a border is listed under both.
ZIP_PREFIXES: dict[str, tuple[tuple[int, int], ...]] = {
    "AL": ((350, 352), (354, 369)),
    "AK": ((995, 999),),
    "AZ": ((850, 850), (852, 853), (855, 857), (859, 860), (863, 865)),
    "AR": ((716, 729),),
    "CA": ((900, 908), (910, 928), (930, 961)),
    "CO": ((800, 816),),
    "CT": ((60, 69),),
    "DE": ((197, 199),),
    "DC": ((200, 200), (202, 205)),
    "FL": ((320, 342), (344, 344), (346, 347), (349, 349)),
    "GA": ((300, 319), (398, 399)),
    "HI": ((967, 968),),
    "ID": ((832, 838),),
    "IL": ((600, 620), (622, 629)),
    "IN": ((460, 479),),
    "IA": ((500, 516), (520, 528)),
    "KS": ((660, 662), (664, 679)),
    "KY": ((400, 418), (420, 427)),
    "LA": ((700, 701), (703, 708), (710, 714)),
    "ME": ((39, 49),),
    "MD": ((206, 212), (214, 219)),
    "MA": ((10, 27), (55, 55)),
    "MI": ((480, 499),),
    "MN": ((550, 551), (553, 567)),
    "MS": ((386, 397),),
    "MO": ((630, 631), (633, 641), (644, 658)),
    "MT": ((590, 599),),
    "NE": ((680, 681), (683, 693)),
    "NV": ((889, 891), (893, 898)),
    "NH": ((30, 38),),
    "NJ": ((70, 89),),
    "NM": ((870, 871), (873, 875), (877, 884)),
    "NY": ((5, 5), (100, 149)),
    "NC": ((270, 289),),
    "ND": ((580, 588),),
    "OH": ((430, 459),),
    "OK": ((730, 731), (734, 741), (743, 749)),
    "OR": ((970, 979),),
    "PA": ((150, 196),),
    "RI": ((28, 29),),
    "SC": ((290, 299),),
    "SD": ((570, 577),),
    "TN": ((370, 385),),
    "TX": ((733, 733), (750, 799), (885, 885)),
    "UT": ((840, 847),),
    "VT": ((50, 54), (56, 59)),
    "VA": ((201, 201), (220, 246)),
    "WA": ((980, 986), (988, 994)),
    "WV": ((247, 268),),
    "WI": ((530, 532), (534, 535), (537, 539), (541, 549)),
    "WY": ((820, 831), (834, 834)),
}

_ZIP_FORMAT = re.compile(r"[0-9]{5}")


def states_for_zip(zip_code: str) -> list[str]:
    """State codes whose ZIP prefixes include this ZIP. Empty when none claims it."""
    prefix = int(zip_code[:3])
    return [
        code for code, ranges in ZIP_PREFIXES.items()
        if any(low <= prefix <= high for low, high in ranges)
    ]


def validate_location(state: Any, zip_code: Any) -> tuple[str, Optional[str]]:
    """Return the cleaned (state, zip) or raise ValueError with a user-facing message.

    ``zip_code`` may be None or "" for "no ZIP". A ZIP must be 5 digits and must
    not clearly belong to other states.
    """
    if not isinstance(state, str) or state not in STATE_CODES:
        raise ValueError(f"Unknown state {state!r}. Use a 2-letter code such as 'TX'.")

    if zip_code is None or zip_code == "":
        return state, None
    if not isinstance(zip_code, str) or not _ZIP_FORMAT.fullmatch(zip_code):
        raise ValueError("Enter a 5-digit ZIP code, or leave it blank.")

    owners = states_for_zip(zip_code)
    if owners and state not in owners:
        raise ValueError(f"ZIP code {zip_code} is in {' or '.join(owners)}, not {state}.")
    return state, zip_code
