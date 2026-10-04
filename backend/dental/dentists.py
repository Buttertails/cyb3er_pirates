"""Small fictional dentist directory for current demonstration ZIP areas."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from urllib.parse import urlencode

from . import locations, mock_plans


DEFAULT_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "dentists.json"
_PHONE = re.compile(r"[2-9]\d{2}-555-01\d{2}")
_ID = re.compile(r"[a-z0-9][a-z0-9-]*")


def _coordinates(item: dict) -> None:
    for key, limit in (("latitude", 90), ("longitude", 180)):
        value = item.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value) > limit:
            raise ValueError(f"Invalid {key} in sample directory.")


def validate_directory(data: dict) -> dict:
    """Reject inconsistent sample data before it can be shown to a member."""
    if not isinstance(data, dict):
        raise ValueError("Invalid sample directory.")
    plans = mock_plans.load_mock_plans_by_id()
    company_plans = data.get("company_plans")
    if not isinstance(company_plans, dict) or not company_plans or any(
        not isinstance(company, str) or not company or not isinstance(plan, str) or plan not in plans
        for company, plan in company_plans.items()
    ):
        raise ValueError("Invalid sample company plans.")
    centers = data.get("zip_centers")
    offices = data.get("offices")
    if not isinstance(centers, list) or not centers or not isinstance(offices, list):
        raise ValueError("Invalid sample directory entries.")
    seen_zips = set()
    for center in centers:
        if not isinstance(center, dict):
            raise ValueError("Invalid sample ZIP center.")
        zip_code, state = center.get("zip"), center.get("state")
        locations.validate_location(state, zip_code)
        if zip_code in seen_zips:
            raise ValueError("Duplicate sample ZIP center.")
        seen_zips.add(zip_code)
        _coordinates(center)
    seen_ids = set()
    for office in offices:
        if not isinstance(office, dict):
            raise ValueError("Invalid sample office.")
        office_id = office.get("id")
        if not isinstance(office_id, str) or not _ID.fullmatch(office_id) or office_id in seen_ids:
            raise ValueError("Invalid or duplicate sample office ID.")
        seen_ids.add(office_id)
        if any(not isinstance(office.get(key), str) or not office[key].strip() for key in ("name", "address")):
            raise ValueError("Sample office needs a name and address.")
        _coordinates(office)
        rating = office.get("rating")
        if isinstance(rating, bool) or not isinstance(rating, (int, float)) or not math.isfinite(rating) or not 0 <= rating <= 5:
            raise ValueError("Invalid sample rating.")
        phone = office.get("phone")
        if not isinstance(phone, str) or not _PHONE.fullmatch(phone):
            raise ValueError("Sample phone must use a reserved fictional number.")
        plan_ids = office.get("plan_ids")
        if (not isinstance(plan_ids, list) or not plan_ids
                or any(not isinstance(plan, str) or plan not in plans for plan in plan_ids)
                or len(set(plan_ids)) != len(plan_ids)):
            raise ValueError("Invalid sample office plan membership.")
    return data


def load_directory(path: str | Path = DEFAULT_FIXTURE) -> dict:
    try:
        return validate_directory(json.loads(Path(path).read_text()))
    except (OSError, json.JSONDecodeError, TypeError) as exc:
        raise ValueError("Sample directory unavailable.") from exc


def _miles(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    lat_a, lon_a, lat_b, lon_b = map(math.radians, (latitude_a, longitude_a, latitude_b, longitude_b))
    delta_lat, delta_lon = lat_b - lat_a, lon_b - lon_a
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    return 3958.7613 * 2 * math.asin(min(1, math.sqrt(a)))


def nearby(directory: dict, zip_code: str, plan_id: str) -> list[dict]:
    center = next((item for item in directory["zip_centers"] if item["zip"] == zip_code), None)
    if center is None:
        return []
    ranked = sorted(
        ((_miles(center["latitude"], center["longitude"], office["latitude"], office["longitude"]), office)
         for office in directory["offices"] if plan_id in office["plan_ids"]),
        key=lambda item: (item[0], item[1]["id"]),
    )
    return [
        {key: office[key] for key in ("id", "name", "address", "rating", "phone")}
        | {"distance_miles": round(distance, 1),
           "maps_url": "https://www.google.com/maps/search/?" + urlencode({"api": 1, "query": f'{office["latitude"]},{office["longitude"]}'})}
        for distance, office in ranked[:5]
    ]


def for_profile(profile, directory: dict) -> dict:
    """Use only a stored profile to produce the existing directory response."""
    def outcome(status, message, offices=None):
        return {"status": status, "message": message, "offices": offices or []}

    if profile is None or not profile.zip:
        return outcome("missing_zip", "Save your ZIP in Update info, then try finding dentists again.")
    plan_id = directory["company_plans"].get(profile.company)
    if not plan_id:
        return outcome("unknown_plan", "We could not match your company plan to the sample dentist directory.")
    if not any(center["zip"] == profile.zip and center["state"] == profile.state
               for center in directory["zip_centers"]):
        return outcome("unsupported_zip", "No sample offices are available near this ZIP. Update your location to try another area.")
    offices = nearby(directory, profile.zip, plan_id)
    if not offices:
        return outcome("no_offices", "No sample in-network offices are available near this ZIP. Update your location to try another area.")
    return outcome("ok", "Sample in-network offices near your saved ZIP. Network status is unverified demo data.", offices)
