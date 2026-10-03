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

``mock_plans`` is pure except for its ``load_mock_plans`` helper, which reads
the local ``Data/plans.json`` fixture from disk (no network).
"""

from . import catalog, engine, mock_plans, models, sequencing

__all__ = ["models", "catalog", "engine", "sequencing", "mock_plans"]
