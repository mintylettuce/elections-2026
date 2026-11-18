#!/usr/bin/env python3
"""Refresh the dashboard's compact data from official public sources."""

import csv
import io
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
RESULTS_URL = (
    "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/"
    "results_pct_20261103.zip"
)
RESULTS_PAGE = (
    "https://www.ncsbe.gov/results-data/election-results/"
    "historical-election-results-data"
)
COUNTIES_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "State_County/MapServer/1/query?where=STATE%3D%2737%27"
    "&outFields=NAME%2CGEOID&outSR=4326&maxAllowableOffset=0.003"
    "&geometryPrecision=5&f=geojson"
)
POPULATION_URL = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2020-2024/counties/totals/co-est2024-alldata.csv"
)
COUNTY_BOUNDARIES_PAGE = (
    "https://www.census.gov/geographies/mapping-files/time-series/geo/"
    "tiger-line-file.html"
)
POPULATION_PAGE = "https://www.census.gov/programs-surveys/popest.html"


def download(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": "NorthCarolinaElectionDashboard/1.0"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read(), response.headers


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    archive, archive_headers = download(RESULTS_URL)
    population_csv, _ = download(POPULATION_URL)
    boundaries_json, _ = download(COUNTIES_URL)

    population_rows = csv.DictReader(
        io.TextIOWrapper(io.BytesIO(population_csv), encoding="latin-1")
    )
    population_by_name = {
        row["CTYNAME"].upper().removesuffix(" COUNTY"): int(
            row["POPESTIMATE2024"]
        )
        for row in population_rows
        if row["STATE"] == "37" and row["SUMLEV"] == "050"
    }

    with zipfile.ZipFile(io.BytesIO(archive)) as archive_file:
        result_file = next(
            name for name in archive_file.namelist() if name.endswith(".txt")
        )
        results = csv.DictReader(
            io.TextIOWrapper(archive_file.open(result_file), encoding="utf-8"),
            delimiter="\t",
        )
        contests = {}
        for row in results:
            county = row["County"].strip().upper()
            contest_name = row["Contest Name"].strip()
            party = row["Choice Party"].strip().upper()
            contest = contests.setdefault(
                contest_name,
                {"parties": set(), "vote_for": set(), "counties": set(), "votes": {}},
            )
            contest["parties"].add(party)
            contest["vote_for"].add(row["Vote For"].strip())
            contest["counties"].add(county)
            key = (county, row["Choice"].strip(), party)
            contest["votes"][key] = contest["votes"].get(key, 0) + int(
                row["Total Votes"]
            )

    eligible = [
        (name, data)
        for name, data in contests.items()
        if len(data["counties"]) == 100
        and data["vote_for"] == {"1"}
        and {"DEM", "REP"}.issubset(data["parties"])
    ]
    if not eligible:
        raise RuntimeError("No statewide, single-choice partisan contests found.")

    boundaries = json.loads(boundaries_json)
    county_order = sorted(
        (
            feature["properties"]["GEOID"],
            feature["properties"]["NAME"].upper().removesuffix(" COUNTY"),
            feature["properties"]["NAME"].removesuffix(" County"),
        )
        for feature in boundaries["features"]
    )
    if len(county_order) != 100:
        raise RuntimeError(
            f"Expected 100 North Carolina counties; got {len(county_order)}."
        )

    races = []
    for contest_name, data in sorted(eligible, key=lambda item: item[0]):
        candidate_totals = {}
        county_results = []
        for geoid, county, county_name in county_order:
            candidates = {}
            for (row_county, choice, party), votes in data["votes"].items():
                if row_county != county:
                    continue
                candidate = candidates.setdefault(
                    (choice, party), {"name": choice, "party": party, "votes": 0}
                )
                candidate["votes"] += votes
                statewide_candidate = candidate_totals.setdefault(
                    (choice, party), {"name": choice, "party": party, "votes": 0}
                )
                statewide_candidate["votes"] += votes

            candidate_list = sorted(
                candidates.values(), key=lambda candidate: candidate["votes"], reverse=True
            )
            party_totals = {}
            for candidate in candidate_list:
                party_totals[candidate["party"]] = (
                    party_totals.get(candidate["party"], 0) + candidate["votes"]
                )
            total_votes = sum(party_totals.values())
            winner = candidate_list[0] if candidate_list else None
            runner_up_votes = (
                candidate_list[1]["votes"] if len(candidate_list) > 1 else 0
            )
            margin_votes = winner["votes"] - runner_up_votes if winner else 0
            winner_party = (
                "TIE" if winner and margin_votes == 0 else winner["party"] if winner else None
            )

            county_results.append(
                {
                    "geoid": geoid,
                    "name": county_name,
                    "population": population_by_name.get(county),
                    "demVotes": party_totals.get("DEM", 0),
                    "repVotes": party_totals.get("REP", 0),
                    "otherVotes": sum(
                        votes for party, votes in party_totals.items()
                        if party not in {"DEM", "REP"}
                    ),
                    "totalVotes": total_votes,
                    "winner": winner["name"] if winner and margin_votes else None,
                    "winnerParty": winner_party,
                    "marginVotes": margin_votes,
                    "marginPercent": (
                        round(margin_votes / total_votes * 100, 4)
                        if total_votes
                        else None
                    ),
                    "candidates": candidate_list,
                }
            )

        county_coverage = sum(row["totalVotes"] > 0 for row in county_results)
        if county_coverage != 100:
            raise RuntimeError(
                f"{contest_name} has results for {county_coverage} counties."
            )

        candidate_list = sorted(
            candidate_totals.values(),
            key=lambda candidate: candidate["votes"],
            reverse=True,
        )
        party_totals = {}
        for candidate in candidate_list:
            party_totals[candidate["party"]] = (
                party_totals.get(candidate["party"], 0) + candidate["votes"]
            )
        races.append(
            {
                "id": contest_name.lower().replace(" ", "-"),
                "name": contest_name.title(),
                "contestName": contest_name,
                "totalVotes": sum(party_totals.values()),
                "demVotes": party_totals.get("DEM", 0),
                "repVotes": party_totals.get("REP", 0),
                "otherVotes": sum(
                    votes for party, votes in party_totals.items()
                    if party not in {"DEM", "REP"}
                ),
                "candidates": candidate_list,
                "counties": county_results,
            }
        )

    last_modified = archive_headers.get("Last-Modified")
    payload = {
        "electionDate": "2026-11-03",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "resultsLastModified": last_modified,
        "status": "unofficial",
        "certificationNote": (
            "The public results download does not identify its certification status."
        ),
        "sources": {
            "results": RESULTS_PAGE,
            "resultsFile": RESULTS_URL,
            "countyBoundaries": COUNTY_BOUNDARIES_PAGE,
            "population": POPULATION_PAGE,
            "populationFile": POPULATION_URL,
        },
        "races": races,
    }
    (DATA_DIR / "election-results.json").write_text(
        json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    (DATA_DIR / "nc-counties.geojson").write_bytes(boundaries_json)
    print(
        f"Updated {len(races)} races and {len(boundaries['features'])} counties. "
        f"Results archive last modified: {last_modified or 'not supplied'}."
    )


if __name__ == "__main__":
    main()
