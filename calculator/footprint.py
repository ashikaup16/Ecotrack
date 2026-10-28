import json
import math
import sys


EMISSION_FACTORS = {
    "car_kg_per_km": 0.192,
    "flight_kg_per_hour": 90,
    "electricity_kg_per_kwh": 0.42,
    "clothing_kg_per_item": 25,
    "diet_kg_per_day": {
        "plant-forward": 1.5,
        "balanced": 2.5,
        "meat-heavy": 3.3,
    },
}


def calculate_footprint(data):
    """Estimate annual emissions in kg CO2e using simple, illustrative factors."""
    try:
        commute_km = float(data["commuteKmPerWeek"])
        flight_hours = float(data["flightHoursPerYear"])
        electricity = float(data["electricityKwhPerMonth"])
        household_size = int(data["householdSize"])
        clothing_items = float(data["clothingItemsPerMonth"])
        diet = data["diet"]
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("All fields must contain valid numbers and a supported diet.") from error

    values = (commute_km, flight_hours, electricity, clothing_items)
    if any(not math.isfinite(value) or value < 0 for value in values) or household_size < 1:
        raise ValueError("Values must be finite and nonnegative, and household size must be at least one.")
    if diet not in EMISSION_FACTORS["diet_kg_per_day"]:
        raise ValueError("Choose a supported diet.")
    if commute_km > 3000 or flight_hours > 1000 or electricity > 10000 or household_size > 30 or clothing_items > 100:
        raise ValueError("One or more values are outside the supported range.")

    categories = {
        "Travel": round(
            commute_km * 52 * EMISSION_FACTORS["car_kg_per_km"]
            + flight_hours * EMISSION_FACTORS["flight_kg_per_hour"]
        ),
        "Home energy": round(
            electricity * 12 * EMISSION_FACTORS["electricity_kg_per_kwh"] / household_size
        ),
        "Food": round(EMISSION_FACTORS["diet_kg_per_day"][diet] * 365),
        "Shopping": round(
            clothing_items * 12 * EMISSION_FACTORS["clothing_kg_per_item"]
        ),
    }
    total = sum(categories.values())

    return {
        "totalKg": total,
        "monthlyKg": round(total / 12),
        "dailyKg": round(total / 365, 1),
        "categories": categories,
        "factors": {
            "carKgPerKm": EMISSION_FACTORS["car_kg_per_km"],
            "flightKgPerHour": EMISSION_FACTORS["flight_kg_per_hour"],
            "electricityKgPerKwh": EMISSION_FACTORS["electricity_kg_per_kwh"],
            "clothingKgPerItem": EMISSION_FACTORS["clothing_kg_per_item"],
            "dietKgPerDay": EMISSION_FACTORS["diet_kg_per_day"][diet],
            "plantForwardDietKgPerDay": EMISSION_FACTORS["diet_kg_per_day"]["plant-forward"],
        },
    }


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(calculate_footprint(payload)))
    except (ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
