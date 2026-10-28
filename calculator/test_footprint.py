import unittest

from footprint import calculate_footprint


class FootprintTests(unittest.TestCase):
    def setUp(self):
        self.inputs = {
            "commuteKmPerWeek": 100,
            "flightHoursPerYear": 8,
            "electricityKwhPerMonth": 300,
            "householdSize": 2,
            "clothingItemsPerMonth": 2,
            "diet": "balanced",
        }

    def test_returns_annual_monthly_and_category_totals(self):
        result = calculate_footprint(self.inputs)

        self.assertEqual(result["totalKg"], sum(result["categories"].values()))
        self.assertEqual(result["monthlyKg"], round(result["totalKg"] / 12))
        self.assertEqual(set(result["categories"]), {"Travel", "Home energy", "Food", "Shopping"})

    def test_shares_home_energy_across_household(self):
        one_person = calculate_footprint({**self.inputs, "householdSize": 1})
        two_people = calculate_footprint({**self.inputs, "householdSize": 2})

        self.assertEqual(one_person["categories"]["Home energy"], 2 * two_people["categories"]["Home energy"])

    def test_rejects_negative_values_and_unknown_diet(self):
        with self.assertRaises(ValueError):
            calculate_footprint({**self.inputs, "commuteKmPerWeek": -1})
        with self.assertRaises(ValueError):
            calculate_footprint({**self.inputs, "commuteKmPerWeek": float("nan")})
        with self.assertRaises(ValueError):
            calculate_footprint({**self.inputs, "diet": "unknown"})


if __name__ == "__main__":
    unittest.main()
