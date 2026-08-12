#!/usr/bin/env python3
"""Convert Ancestry GEDCOM into src/data/familyDatabase.ts."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEDCOM_PATH = ROOT / "data" / "Ruiz Family Tree.ged"
OUT_PATH = ROOT / "src" / "data" / "familyDatabase.ts"
DEFAULT_ROOT_ID = "I18123023582"

PLACE_TOKENS = [
    "New Jersey",
    "England",
    "Pennsylvania",
    "Mexico",
    "California",
    "United States",
    "Scotland",
    "Ireland",
]

YEAR_RE = re.compile(r"\b(\d{3,4})\b")


def parse_gedcom(text: str) -> list[dict]:
    records: list[dict] = []
    current: dict | None = None
    for raw in text.splitlines():
        if not raw.strip():
            continue
        match = re.match(r"^(\d+)\s+(.*)$", raw)
        if not match:
            continue
        level = int(match.group(1))
        rest = match.group(2)
        if level == 0:
            if current is not None:
                records.append(current)
            parts = rest.split(" ", 1)
            pointer = None
            tag = parts[0]
            if parts[0].startswith("@") and parts[0].endswith("@"):
                pointer = parts[0][1:-1]
                tag = parts[1] if len(parts) > 1 else ""
            current = {"id": pointer, "tag": tag, "lines": []}
        elif current is not None:
            current["lines"].append((level, rest))
    if current is not None:
        records.append(current)
    return records


def format_name(raw: str) -> str:
    name = raw.strip()
    name = re.sub(r"/([^/]*)/", r"\1", name)
    name = re.sub(r"\s+", " ", name).strip(" ,")
    return name


def extract_year(date: str) -> int | None:
    if not date:
        return None
    years = [int(y) for y in YEAR_RE.findall(date) if 1000 <= int(y) <= 2100]
    if not years:
        return None
    return years[-1]


def event_fields(lines: list[tuple[int, str]], start: int) -> tuple[str, str, int]:
    """Read DATE/PLAC under a level-1 event starting at `start`. Returns (date, place, next_index)."""
    date = ""
    place = ""
    i = start + 1
    while i < len(lines) and lines[i][0] > 1:
        level, rest = lines[i]
        if level == 2 and rest.startswith("DATE "):
            date = rest[5:].strip()
        elif level == 2 and rest.startswith("PLAC "):
            place = rest[5:].strip()
        i += 1
    return date, place, i


def parse_individual(record: dict) -> dict:
    person = {
        "id": record["id"],
        "name": "",
        "sex": "",
        "birthDate": "",
        "birthYear": None,
        "birthPlace": "",
        "deathDate": "",
        "deathYear": None,
        "deathPlace": "",
        "places": [],
        "occupation": [],
        "famc": [],
        "fams": [],
    }
    places: list[str] = []
    lines = record["lines"]
    i = 0
    while i < len(lines):
        level, rest = lines[i]
        if level != 1:
            i += 1
            continue
        if rest.startswith("NAME "):
            person["name"] = format_name(rest[5:])
            i += 1
            continue
        if rest.startswith("SEX "):
            person["sex"] = rest[4:].strip()
            i += 1
            continue
        if rest.startswith("FAMC "):
            pointer = rest[5:].strip().strip("@")
            if pointer:
                person["famc"].append(pointer)
            i += 1
            continue
        if rest.startswith("FAMS "):
            pointer = rest[5:].strip().strip("@")
            if pointer:
                person["fams"].append(pointer)
            i += 1
            continue
        if rest == "BIRT" or rest.startswith("BIRT "):
            date, place, i = event_fields(lines, i)
            person["birthDate"] = date
            person["birthYear"] = extract_year(date)
            person["birthPlace"] = place
            if place:
                places.append(place)
            continue
        if rest == "DEAT" or rest.startswith("DEAT "):
            date, place, i = event_fields(lines, i)
            person["deathDate"] = date
            person["deathYear"] = extract_year(date)
            person["deathPlace"] = place
            if place:
                places.append(place)
            continue
        if rest == "RESI" or rest.startswith("RESI "):
            _date, place, i = event_fields(lines, i)
            if place:
                places.append(place)
            continue
        i += 1

    # Preserve order, drop empties/dupes.
    seen: set[str] = set()
    ordered: list[str] = []
    for place in places:
        if place and place not in seen:
            seen.add(place)
            ordered.append(place)
    person["places"] = ordered
    return person


def parse_family(record: dict) -> dict:
    family = {
        "id": record["id"],
        "husb": None,
        "wife": None,
        "children": [],
        "marriageDate": "",
        "marriagePlace": "",
        "marriageYear": None,
    }
    lines = record["lines"]
    i = 0
    while i < len(lines):
        level, rest = lines[i]
        if level != 1:
            i += 1
            continue
        if rest.startswith("HUSB "):
            family["husb"] = rest[5:].strip().strip("@")
            i += 1
            continue
        if rest.startswith("WIFE "):
            family["wife"] = rest[5:].strip().strip("@")
            i += 1
            continue
        if rest.startswith("CHIL "):
            child = rest[5:].strip().strip("@")
            if child:
                family["children"].append(child)
            i += 1
            continue
        if rest == "MARR" or rest.startswith("MARR "):
            date, place, i = event_fields(lines, i)
            family["marriageDate"] = date
            family["marriagePlace"] = place
            family["marriageYear"] = extract_year(date)
            continue
        i += 1
    return family


def build_database(gedcom_path: Path, root_id: str = DEFAULT_ROOT_ID) -> dict:
    records = parse_gedcom(gedcom_path.read_text(encoding="utf-8", errors="replace"))
    individuals = [parse_individual(r) for r in records if r["tag"] == "INDI" and r["id"]]
    families = [parse_family(r) for r in records if r["tag"] == "FAM" and r["id"]]
    by_id = {person["id"]: person for person in individuals}
    fam_by_id = {family["id"]: family for family in families}

    parents: dict[str, list[str]] = defaultdict(list)
    spouses: dict[str, list[str]] = defaultdict(list)
    children: dict[str, list[str]] = defaultdict(list)

    for person in individuals:
        for fam_id in person["famc"]:
            family = fam_by_id.get(fam_id)
            if not family:
                continue
            for parent_id in (family["husb"], family["wife"]):
                if parent_id and parent_id in by_id and parent_id not in parents[person["id"]]:
                    parents[person["id"]].append(parent_id)

        for fam_id in person["fams"]:
            family = fam_by_id.get(fam_id)
            if not family:
                continue
            partner = None
            if family["husb"] == person["id"]:
                partner = family["wife"]
            elif family["wife"] == person["id"]:
                partner = family["husb"]
            if partner and partner in by_id and partner not in spouses[person["id"]]:
                spouses[person["id"]].append(partner)
            for child_id in family["children"]:
                if child_id in by_id and child_id not in children[person["id"]]:
                    children[person["id"]].append(child_id)

    if root_id not in by_id:
        raise SystemExit(f"Root person {root_id} not found in GEDCOM")

    # Ancestors: positive generation (1 = parents, 2 = grandparents, …).
    generation: dict[str, int] = {root_id: 0}
    queue: deque[str] = deque([root_id])
    while queue:
        person_id = queue.popleft()
        for parent_id in parents[person_id]:
            if parent_id not in generation:
                generation[parent_id] = generation[person_id] + 1
                queue.append(parent_id)

    # Descendants: negative generation (−1 = children, −2 = grandchildren, …).
    queue = deque([root_id])
    while queue:
        person_id = queue.popleft()
        for child_id in children[person_id]:
            if child_id not in generation:
                generation[child_id] = generation[person_id] - 1
                queue.append(child_id)

    # Root spouses share the present generation so they stay “near family”.
    for spouse_id in spouses[root_id]:
        if spouse_id not in generation:
            generation[spouse_id] = 0

    focus_ids = set(generation)

    people_out = []
    for person in individuals:
        person_id = person["id"]
        people_out.append(
            {
                "id": person_id,
                "name": person["name"] or person_id,
                "sex": person["sex"],
                "birthDate": person["birthDate"],
                "birthYear": person["birthYear"],
                "birthPlace": person["birthPlace"],
                "deathDate": person["deathDate"],
                "deathYear": person["deathYear"],
                "deathPlace": person["deathPlace"],
                "places": person["places"],
                "occupation": [],
                "parents": parents[person_id],
                "spouses": spouses[person_id],
                "children": children[person_id],
                "generation": generation.get(person_id),
                "focus": person_id in focus_ids,
            }
        )

    years = [(p["birthYear"], p["name"]) for p in people_out if isinstance(p["birthYear"], int)]
    if not years:
        raise SystemExit("No birth years found in GEDCOM")
    earliest_year, earliest_name = min(years, key=lambda item: item[0])
    latest_year = max(year for year, _ in years)

    place_counts: Counter[str] = Counter()
    for person in people_out:
        unique_places = set()
        for place in [person["birthPlace"], person["deathPlace"], *person["places"]]:
            if place:
                unique_places.add(place)
        for place in unique_places:
            for token in PLACE_TOKENS:
                if re.search(rf"\b{re.escape(token)}\b", place, re.I):
                    place_counts[token] += 1

    surname_counts: Counter[str] = Counter()
    for person in people_out:
        parts = person["name"].split()
        if parts:
            surname_counts[parts[-1]] += 1

    return {
        "people": people_out,
        "root": root_id,
        "stats": {
            "people": len(people_out),
            "families": len(families),
            "earliestYear": earliest_year,
            "latestYear": latest_year,
            "earliestName": earliest_name,
            "places": place_counts.most_common(),
            "surnames": surname_counts.most_common(10),
        },
    }


def write_typescript(database: dict, out_path: Path) -> None:
    payload = json.dumps(database, indent=2, ensure_ascii=False)
    out_path.write_text(
        'import type { FamilyDatabase } from "../types";\n\n'
        f"export const familyDatabase: FamilyDatabase = {payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    if not GEDCOM_PATH.exists():
        raise SystemExit(f"Missing GEDCOM at {GEDCOM_PATH}")
    database = build_database(GEDCOM_PATH)
    write_typescript(database, OUT_PATH)
    stats = database["stats"]
    print(
        f"Wrote {OUT_PATH.relative_to(ROOT)} — "
        f"{stats['people']} people, {stats['families']} families, "
        f"{stats['earliestYear']}–{stats['latestYear']}"
    )


if __name__ == "__main__":
    main()
