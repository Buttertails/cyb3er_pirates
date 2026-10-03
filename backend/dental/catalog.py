"""CDT procedure catalog + realistic seed data.

The catalog maps the frontend's procedure IDs (see frontend/js/options.js) to a
dental coverage category, representative ADA CDT codes, and typical allowed
amounts in/out of network. Costs are rough national-ballpark figures in cents,
suitable for a demo — a real deployment would pull localized fee schedules.

Also provides a sample employer plan and a sample employee with usage history
so the engine and endpoints can be demoed end-to-end without a populated
Firestore.
"""

from __future__ import annotations

from .models import (
    Category,
    CoverageTier,
    Employee,
    Employer,
    EmployerPlan,
    FrequencyLimit,
    Network,
    ProcedureCatalogEntry,
    UsageRecord,
    dollars,
)


# --------------------------------------------------------------------------- #
# Procedure catalog — keyed by the frontend procedure IDs
# --------------------------------------------------------------------------- #

PROCEDURE_CATALOG: dict[str, ProcedureCatalogEntry] = {
    "cleaning": ProcedureCatalogEntry(
        id="cleaning",
        label="Routine cleaning",
        category=Category.PREVENTIVE,
        cdt_codes=["D1110", "D1120"],
        typical_cost_in_network_cents=dollars(95),
        typical_cost_out_network_cents=dollars(130),
        description="Regular hygiene visit (prophylaxis).",
    ),
    "exam-xrays": ProcedureCatalogEntry(
        id="exam-xrays",
        label="Exam and X-rays",
        category=Category.PREVENTIVE,
        cdt_codes=["D0120", "D0210", "D0274"],
        typical_cost_in_network_cents=dollars(120),
        typical_cost_out_network_cents=dollars(165),
        description="Periodic exam with bitewing/full-mouth imaging.",
    ),
    "filling": ProcedureCatalogEntry(
        id="filling",
        label="Filling",
        category=Category.BASIC,
        cdt_codes=["D2391", "D2392", "D2330"],
        typical_cost_in_network_cents=dollars(200),
        typical_cost_out_network_cents=dollars(290),
        description="Composite restoration for a cavity.",
    ),
    "extraction": ProcedureCatalogEntry(
        id="extraction",
        label="Extraction",
        category=Category.BASIC,
        cdt_codes=["D7140", "D7210"],
        typical_cost_in_network_cents=dollars(250),
        typical_cost_out_network_cents=dollars(375),
        description="Tooth removal (simple or surgical, incl. wisdom teeth).",
    ),
    "root-canal": ProcedureCatalogEntry(
        id="root-canal",
        label="Root canal",
        category=Category.MAJOR,
        cdt_codes=["D3310", "D3320", "D3330"],
        typical_cost_in_network_cents=dollars(1000),
        typical_cost_out_network_cents=dollars(1400),
        description="Endodontic treatment for an infected tooth.",
    ),
    "crown-bridge": ProcedureCatalogEntry(
        id="crown-bridge",
        label="Crown or bridge",
        category=Category.MAJOR,
        cdt_codes=["D2740", "D2750", "D6240"],
        typical_cost_in_network_cents=dollars(1200),
        typical_cost_out_network_cents=dollars(1700),
        description="Cap or fixed replacement for damaged/missing teeth.",
    ),
    "implant": ProcedureCatalogEntry(
        id="implant",
        label="Implant",
        category=Category.MAJOR,
        cdt_codes=["D6010", "D6058"],
        typical_cost_in_network_cents=dollars(3000),
        typical_cost_out_network_cents=dollars(4200),
        description="Permanent replacement for a missing tooth.",
    ),
    "dentures": ProcedureCatalogEntry(
        id="dentures",
        label="Dentures or partials",
        category=Category.MAJOR,
        cdt_codes=["D5110", "D5120", "D5213"],
        typical_cost_in_network_cents=dollars(1800),
        typical_cost_out_network_cents=dollars(2500),
        description="Removable full or partial tooth replacement.",
    ),
    "orthodontics": ProcedureCatalogEntry(
        id="orthodontics",
        label="Orthodontics",
        category=Category.ORTHODONTIC,
        cdt_codes=["D8080", "D8090"],
        typical_cost_in_network_cents=dollars(5500),
        typical_cost_out_network_cents=dollars(6500),
        description="Braces or clear aligners.",
    ),
    "cosmetic": ProcedureCatalogEntry(
        id="cosmetic",
        label="Cosmetic",
        category=Category.COSMETIC,
        cdt_codes=["D9972", "D2962"],
        typical_cost_in_network_cents=dollars(600),
        typical_cost_out_network_cents=dollars(800),
        description="Whitening, veneers, or bonding (usually not covered).",
    ),
    # "emergency" and "other" from the frontend are intentionally not priced
    # here; they are triaged by the chat layer into a concrete procedure first.
}


def get_procedure(procedure_id: str) -> ProcedureCatalogEntry | None:
    return PROCEDURE_CATALOG.get(procedure_id)


# --------------------------------------------------------------------------- #
# Seed: a sample employer, plan, employee, and usage history
# --------------------------------------------------------------------------- #

SAMPLE_EMPLOYER = Employer(
    id="acme-co",
    name="Acme Corporation",
    active_plan_id="acme-ppo-2026",
)


def sample_plan() -> EmployerPlan:
    """A typical 100/80/50 PPO plan: $1,500 annual max, $50 deductible."""
    return EmployerPlan(
        id="acme-ppo-2026",
        employer_id="acme-co",
        name="Acme PPO 2026",
        plan_year_start_month=1,
        plan_year_start_day=1,
        annual_maximum_cents=dollars(1500),
        orthodontic_lifetime_maximum_cents=dollars(1500),
        individual_deductible_cents=dollars(50),
        deductible_applies_to_preventive=False,
        coverage_tiers=[
            CoverageTier(Category.PREVENTIVE, in_network_rate=1.00, out_network_rate=0.80),
            CoverageTier(Category.BASIC, in_network_rate=0.80, out_network_rate=0.60,
                         waiting_period_months=0),
            CoverageTier(Category.MAJOR, in_network_rate=0.50, out_network_rate=0.40,
                         waiting_period_months=12),
            CoverageTier(Category.ORTHODONTIC, in_network_rate=0.50, out_network_rate=0.50,
                         waiting_period_months=12),
            CoverageTier(Category.COSMETIC, in_network_rate=0.0, out_network_rate=0.0),
        ],
        frequency_limits=[
            FrequencyLimit("cleaning", per_year=2, note="2 cleanings per plan year."),
            FrequencyLimit("exam-xrays", per_year=2, note="2 exams per plan year."),
            FrequencyLimit("crown-bridge", per_months=60,
                           note="Crown on the same tooth once every 5 years."),
        ],
    )


def sample_employee() -> Employee:
    return Employee(
        id="emp-jane",
        employer_id="acme-co",
        name="Jane Doe",
        plan_id="acme-ppo-2026",
        enrollment_date="2024-03-01",
        state="TX",
        zip="78701",
    )


def sample_usage() -> list[UsageRecord]:
    """Jane has used one cleaning and one filling so far this plan year."""
    return [
        UsageRecord(
            id="u1",
            procedure_id="cleaning",
            date="2026-02-10",
            plan_pays_cents=dollars(95),
            employee_paid_cents=0,
            category=Category.PREVENTIVE.value,
            network=Network.IN_NETWORK.value,
        ),
        UsageRecord(
            id="u2",
            procedure_id="filling",
            date="2026-03-22",
            plan_pays_cents=dollars(120),   # 80% of ~$200 less a bit of deductible
            employee_paid_cents=dollars(80),
            category=Category.BASIC.value,
            tooth="#14",
            network=Network.IN_NETWORK.value,
        ),
    ]
