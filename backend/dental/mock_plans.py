"""Models + loader for the fictional plan data in ``Data/plans.json``.

The challenge supplies company plans as JSON (see ``Data/plans.json``). That
file speaks a different vocabulary than the deterministic engine:

    plans.json                         engine (models.py)
    ------------------------------     ---------------------------------------
    planId (-> "C0"/"I1"), name "A"    id (str), name (str)
    group (bool)                       (not modeled — carried through)
    maxCoverage (-1 == unlimited)      annual_maximum_cents
    adult / children member blocks     one plan applies to the whole person
      covered: ["Routine","Basic",..]  coverage_tiers with explicit rates
      premium / premiumCovered         (not modeled — carried through)
      deductible (-1 == none)          individual_deductible_cents

This module keeps a faithful, 1:1 representation of the JSON (so the data model
"matches" the source) **and** provides an adapter that projects a plan + member
type onto the engine's :class:`EmployerPlan`, so all the existing coverage math
keeps working unchanged.

Sentinels: the JSON uses ``-1`` to mean "not applicable". We decode it as
``None`` and treat it as *unlimited* for ``maxCoverage`` and *no deductible* for
``deductible``.

Coverage rates: the JSON only says *which* categories are covered, not at what
rate. We apply conventional dental rates to covered categories
(preventive 100% / basic 80% / major 50% / orthodontic 50%) and 0% to anything
not listed. These defaults live in :data:`DEFAULT_CATEGORY_RATES` and are easy
to tune as the real data model firms up.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from .models import (
    Category,
    CoverageTier,
    EmployerPlan,
    dollars,
)


# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

# JSON uses -1 as a "not applicable / unlimited / none" sentinel.
SENTINEL = -1

# plans.json category labels -> engine Category. "Orthodontia" is the JSON
# spelling of the engine's "orthodontic" bucket.
CATEGORY_BY_JSON_NAME: dict[str, Category] = {
    "Routine": Category.PREVENTIVE,
    "Basic": Category.BASIC,
    "Major": Category.MAJOR,
    "Orthodontia": Category.ORTHODONTIC,
}

# Conventional reimbursement rates applied to *covered* categories, since the
# JSON encodes coverage as membership in a list rather than a percentage.
# (in_network_rate, out_network_rate)
DEFAULT_CATEGORY_RATES: dict[Category, tuple[float, float]] = {
    Category.PREVENTIVE: (1.00, 0.80),
    Category.BASIC: (0.80, 0.60),
    Category.MAJOR: (0.50, 0.40),
    Category.ORTHODONTIC: (0.50, 0.50),
    Category.COSMETIC: (0.0, 0.0),
}


def _decode_sentinel(value: Any) -> Optional[float]:
    """Return ``None`` for the ``-1`` sentinel, otherwise the numeric value."""
    if value is None:
        return None
    if isinstance(value, (int, float)) and value == SENTINEL:
        return None
    return value


def _encode_sentinel(value: Optional[float]) -> Any:
    """Inverse of :func:`_decode_sentinel` for round-tripping back to JSON."""
    return SENTINEL if value is None else value


# Plan-id prefixes: company (group) plans are "C", independent plans are "I".
COMPANY_PLAN_PREFIX = "C"
INDEPENDENT_PLAN_PREFIX = "I"


def normalize_plan_id(raw_plan_id: Any, group: bool) -> str:
    """Return a prefixed string plan id (e.g. ``"C0"`` / ``"I1"``).

    Plan ids are strings prefixed by whether the plan is a company/group plan
    (``"C"``) or an independent one (``"I"``). If the source already carries a
    valid prefix it is used as-is; a bare value (e.g. the integer ``0``) is
    prefixed based on the ``group`` flag.
    """
    text = str(raw_plan_id).strip()
    if text[:1] in (COMPANY_PLAN_PREFIX, INDEPENDENT_PLAN_PREFIX) and text[1:].isdigit():
        return text
    prefix = COMPANY_PLAN_PREFIX if group else INDEPENDENT_PLAN_PREFIX
    return f"{prefix}{text}"


# --------------------------------------------------------------------------- #
# Member type
# --------------------------------------------------------------------------- #

class MemberType(str, Enum):
    """Which block of a plan applies to a person."""

    ADULT = "adult"
    CHILDREN = "children"


# --------------------------------------------------------------------------- #
# Member coverage block (the "adult" / "children" sub-objects)
# --------------------------------------------------------------------------- #

@dataclass
class MemberCoverage:
    """Coverage terms for one member type (adult or children) within a plan.

    ``covered`` holds the engine Categories this member type is covered for.
    ``premium`` / ``premium_covered`` are carried through from the JSON for
    display; the engine does not use them for coverage math. ``deductible`` is
    in dollars (``None`` means no deductible).
    """

    covered: list[Category] = field(default_factory=list)
    premium: Optional[float] = None          # monthly premium in dollars
    premium_covered: Optional[float] = None  # % of premium the employer covers
    deductible: Optional[float] = None       # dollars; None == no deductible

    @property
    def is_offered(self) -> bool:
        """A member block with no covered categories isn't offered (e.g. a plan
        with no children coverage uses an empty ``covered`` list)."""
        return len(self.covered) > 0

    def covers(self, category: Category) -> bool:
        return category in self.covered

    def to_dict(self) -> dict[str, Any]:
        """Serialize back to the ``plans.json`` shape (with -1 sentinels)."""
        return {
            "covered": [_json_name_for(c) for c in self.covered],
            "premium": _encode_sentinel(self.premium),
            "premiumCovered": _encode_sentinel(self.premium_covered),
            "deductible": _encode_sentinel(self.deductible),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemberCoverage":
        covered: list[Category] = []
        for name in data.get("covered", []):
            cat = CATEGORY_BY_JSON_NAME.get(name)
            if cat is None:
                raise ValueError(f"Unknown coverage category in plans.json: {name!r}")
            covered.append(cat)
        return cls(
            covered=covered,
            premium=_decode_sentinel(data.get("premium")),
            premium_covered=_decode_sentinel(data.get("premiumCovered")),
            deductible=_decode_sentinel(data.get("deductible")),
        )


# --------------------------------------------------------------------------- #
# Mock plan (one entry in the "plans" array)
# --------------------------------------------------------------------------- #

@dataclass
class MockPlan:
    """A single fictional company plan as described in ``plans.json``.

    This is a faithful mirror of the JSON. Use :meth:`to_employer_plan` to get
    an engine-ready :class:`EmployerPlan` for a specific member type.
    """

    name: str
    plan_id: str  # prefixed string: "C<n>" for company plans, "I<n>" for independent
    group: bool = False
    max_coverage: Optional[float] = None  # dollars; None == unlimited
    adult: MemberCoverage = field(default_factory=MemberCoverage)
    children: MemberCoverage = field(default_factory=MemberCoverage)

    # -- member lookup ------------------------------------------------------- #

    def member(self, member_type: MemberType) -> MemberCoverage:
        return self.adult if member_type == MemberType.ADULT else self.children

    def offers(self, member_type: MemberType) -> bool:
        return self.member(member_type).is_offered

    # -- serialization ------------------------------------------------------- #

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "planId": self.plan_id,
            "group": self.group,
            "maxCoverage": _encode_sentinel(self.max_coverage),
            "adult": self.adult.to_dict(),
            "children": self.children.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MockPlan":
        group = bool(data.get("group", False))
        return cls(
            name=data["name"],
            plan_id=normalize_plan_id(data["planId"], group),
            group=group,
            max_coverage=_decode_sentinel(data.get("maxCoverage")),
            adult=MemberCoverage.from_dict(data.get("adult", {})),
            children=MemberCoverage.from_dict(data.get("children", {})),
        )

    # -- adapter into the engine's EmployerPlan ------------------------------ #

    def to_employer_plan(
        self,
        member_type: MemberType = MemberType.ADULT,
        *,
        employer_id: Optional[str] = None,
        plan_year_start_month: int = 1,
        plan_year_start_day: int = 1,
    ) -> EmployerPlan:
        """Project this plan + member type onto an engine :class:`EmployerPlan`.

        Covered categories get conventional rates (see
        :data:`DEFAULT_CATEGORY_RATES`); uncovered categories get 0% so the
        engine naturally reports them as not covered. ``maxCoverage == -1``
        (unlimited) is represented as a very large annual maximum so the cap
        never binds.
        """
        if not self.offers(member_type):
            raise ValueError(
                f"Plan {self.name!r} does not offer {member_type.value} coverage."
            )

        block = self.member(member_type)

        tiers: list[CoverageTier] = []
        for category, (in_rate, out_rate) in DEFAULT_CATEGORY_RATES.items():
            covered = block.covers(category)
            tiers.append(
                CoverageTier(
                    category=category,
                    in_network_rate=in_rate if covered else 0.0,
                    out_network_rate=out_rate if covered else 0.0,
                )
            )

        # Unlimited max -> a cap large enough never to bind.
        if self.max_coverage is None:
            annual_max_cents = dollars(10_000_000)
        else:
            annual_max_cents = dollars(self.max_coverage)

        deductible_cents = (
            0 if block.deductible is None else dollars(block.deductible)
        )

        return EmployerPlan(
            id=f"{self.plan_id}-{member_type.value}",
            employer_id=employer_id or f"company-{self.name.lower()}",
            name=f"Plan {self.name} ({member_type.value})",
            plan_year_start_month=plan_year_start_month,
            plan_year_start_day=plan_year_start_day,
            annual_maximum_cents=annual_max_cents,
            orthodontic_lifetime_maximum_cents=annual_max_cents,
            individual_deductible_cents=deductible_cents,
            deductible_applies_to_preventive=False,
            coverage_tiers=tiers,
            frequency_limits=[],
        )


# --------------------------------------------------------------------------- #
# Loader
# --------------------------------------------------------------------------- #

def _json_name_for(category: Category) -> str:
    """Inverse of CATEGORY_BY_JSON_NAME (for serialization)."""
    for name, cat in CATEGORY_BY_JSON_NAME.items():
        if cat == category:
            return name
    return category.value


def default_plans_path() -> Path:
    """Locate ``Data/plans.json`` relative to the repo root.

    Layout: <repo>/Data/plans.json and <repo>/backend/dental/mock_plans.py,
    so the repo root is three parents up from this file.
    """
    return Path(__file__).resolve().parents[2] / "Data" / "plans.json"


def load_mock_plans(path: Optional[Path | str] = None) -> list[MockPlan]:
    """Read and parse ``plans.json`` into :class:`MockPlan` objects."""
    p = Path(path) if path is not None else default_plans_path()
    with p.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return [MockPlan.from_dict(entry) for entry in data.get("plans", [])]


def load_mock_plans_by_id(path: Optional[Path | str] = None) -> dict[str, MockPlan]:
    """Same as :func:`load_mock_plans` but keyed by the prefixed ``plan_id``."""
    return {plan.plan_id: plan for plan in load_mock_plans(path)}
