from pathlib import Path

BASE = Path(__file__).parent
RAW = BASE / "data" / "raw"
CLEAN = BASE / "data" / "clean"
SEED = 42

# region -> country -> cities
GEO = {
    "North America": {"United States": ["New York", "Austin", "Seattle", "Chicago", "Miami"],
                      "Canada": ["Toronto", "Vancouver", "Montreal"]},
    "Europe": {"United Kingdom": ["London", "Manchester"], "Germany": ["Berlin", "Munich"],
               "France": ["Paris", "Lyon"], "Spain": ["Madrid", "Barcelona"]},
    "Asia Pacific": {"Pakistan": ["Islamabad", "Lahore", "Karachi"], "India": ["Mumbai", "Bengaluru", "Delhi"],
                     "Japan": ["Tokyo", "Osaka"], "Australia": ["Sydney", "Melbourne"]},
    "Middle East": {"UAE": ["Dubai", "Abu Dhabi"], "Saudi Arabia": ["Riyadh", "Jeddah"]},
    "Latin America": {"Brazil": ["Sao Paulo", "Rio de Janeiro"], "Mexico": ["Mexico City", "Guadalajara"]},
}
REGION_WEIGHTS = [0.32, 0.26, 0.24, 0.08, 0.10]
COUNTRY_REGION = {c: r for r, cs in GEO.items() for c in cs}
SEGMENTS = ["Consumer", "Corporate", "Small Business"]
VALID_STATUS = {"completed", "returned", "cancelled"}