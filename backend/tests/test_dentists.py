"""Fictional dentist directory validation and distance ranking."""

from copy import deepcopy

import pytest

from dental import dentists


@pytest.fixture
def directory_data():
    return {
        "company_plans": {"acme-co": "C0", "demo-company-2": "C2"},
        "zip_centers": [
            {"zip": "27519", "state": "NC", "latitude": 35.808392, "longitude": -78.886546},
            {"zip": "27577", "state": "NC", "latitude": 35.491873, "longitude": -78.344659},
        ],
        "offices": [
            {"id": "far", "name": "Sample Far Dental", "address": "1 Sample Lane, Cary, NC 27519",
             "latitude": 35.85, "longitude": -78.89, "rating": 4.1,
             "phone": "919-555-0101", "plan_ids": ["C0"]},
            {"id": "near", "name": "Sample Near Dental", "address": "2 Sample Lane, Cary, NC 27519",
             "latitude": 35.81, "longitude": -78.88, "rating": 4.8,
             "phone": "919-555-0102", "plan_ids": ["C0", "C2"]},
            {"id": "other", "name": "Sample Other Dental", "address": "3 Sample Lane, Cary, NC 27519",
             "latitude": 35.82, "longitude": -78.87, "rating": 4.2,
             "phone": "919-555-0103", "plan_ids": ["C2"]},
        ],
    }


@pytest.mark.parametrize("mutate", [
    lambda data: data["offices"][1].update(id="far"),
    lambda data: data["offices"][0].update(latitude=float("inf")),
    lambda data: data["offices"][0].update(rating=5.1),
    lambda data: data["offices"][0].update(phone="919-555-2200"),
    lambda data: data["offices"][0].update(plan_ids=["UNKNOWN"]),
    lambda data: data["offices"][0].update(plan_ids=[{}]),
    lambda data: data["company_plans"].update({"acme-co": {}}),
    lambda data: data["zip_centers"][0].update(state="TX"),
    lambda data: data["zip_centers"][1].update(zip="27519"),
])
def test_rejects_invalid_directory_data(directory_data, mutate):
    data = deepcopy(directory_data)
    mutate(data)
    with pytest.raises(ValueError):
        dentists.validate_directory(data)


def test_nearby_orders_raw_distance_then_id_and_filters_plan(directory_data):
    directory_data["offices"].append({**directory_data["offices"][1],
                                      "id": "alpha", "name": "Sample Alpha Dental"})
    directory = dentists.validate_directory(directory_data)
    results = dentists.nearby(directory, "27519", "C0")
    assert [office["id"] for office in results] == ["alpha", "near", "far"]
    assert all(a["distance_miles"] <= b["distance_miles"] for a, b in zip(results, results[1:]))
    assert all(office["maps_url"].startswith("https://www.google.com/maps/search/?api=1&query=")
               for office in results)
    assert [office["id"] for office in dentists.nearby(directory, "27519", "C2")] == ["alpha", "near", "other"]


def test_nearby_limits_to_five(directory_data):
    directory_data["offices"] = [{**directory_data["offices"][1], "id": f"office-{n}"}
                                 for n in range(7)]
    directory = dentists.validate_directory(directory_data)
    assert len(dentists.nearby(directory, "27519", "C0")) == 5
