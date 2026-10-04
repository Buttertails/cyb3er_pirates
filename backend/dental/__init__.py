"""Dental Benefits Optimizer — deterministic engine (Firestore-agnostic).

This package contains pure business logic and data models. It must NOT import
firebase_admin, firebase_functions, or perform any network/IO. That keeps the
engine fully unit-testable and reusable from any entry point (Cloud Functions,
a CLI, a notebook, or tests).

Public surface:
    models      — Firestore-shaped dataclasses (EmployerPlan, Employee, UsageRecord, ...)
    catalog     — CDT procedure catalog + seed data aligned to the frontend
    engine      — coverage/cost estimation + bonus features
    sequencing  — cross-plan-year timing optimizer
    mock_plans  — models + adapter for the fictional Data/plans.json source
    mock_data   — models + loaders for Data/company.json, person.json, procedure.json
    locations   — validation for the user's saved state + ZIP

``mock_plans`` / ``mock_data`` are pure except for their ``load_*`` helpers,
which read the local fixtures in ``Data/`` from disk (no network).
"""

from . import (
    catalog,
    engine,
    locations,
    mock_data,
    mock_plans,
    models,
    sequencing,
)

__all__ = [
    "models",
    "catalog",
    "engine",
    "sequencing",
    "mock_plans",
    "mock_data",
    "locations",
]
