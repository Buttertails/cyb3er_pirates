"""Company -> fictional demo employee, mirroring ``frontend/src/lib/demoEmployees.js``.

Unlike the frontend, there is no fallback employee: background jobs (reminder
emails) must not act on another employee's sample usage for an unknown company.
``tests/test_company_employees.py`` keeps this map in sync with the frontend.
"""

from __future__ import annotations

from types import MappingProxyType
from typing import Optional

COMPANY_EMPLOYEES = MappingProxyType({
    "acme-co": "demo-a-pat",
    "demo-company-2": "demo-c-lee",
    "demo-company-3": "demo-a-sam",
    "demo-company-a": "demo-a-pat",
    "demo-company-c": "demo-c-lee",
})


def employee_id_for_company(company: Optional[str]) -> Optional[str]:
    if not isinstance(company, str):
        return None
    return COMPANY_EMPLOYEES.get(company)
