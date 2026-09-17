#!/usr/bin/env python3
"""Copies valid recipe files from the sibling picopak-library repo's recipes/picopaks/ (the
user's own PicoBrew vendor-API sync — see that repo's sync_recipes.sh) into this repo's
data/picopak-library/picopaks/, skipping unparseable/empty/junk entries, and builds a
lightweight index (data/picopak-library/picopak-index.json) for the "PicoPak" tab in the
recipe importer (app/routes/api.picobrew-recipes.ts) to search/sort/paginate over without
reading every file.

Re-run this after re-syncing the source repo.
"""

import json
import pathlib
import re

SOURCE_DIR = pathlib.Path("/Users/agonzalez/Projects/PicoBrew/picopak-library/recipes/picopaks")
DEST_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "picopak-library" / "picopaks"
INDEX_PATH = DEST_DIR.parent / "picopak-index.json"

_KEYBOARD_MASH = re.compile(r"(asdf|qwer|zxcv|asdfg|qwerty)+[a-z0-9]*", re.IGNORECASE)


def is_junk_name(name: str) -> bool:
    """True for engineering/QA test batches and keyboard-mashed placeholders ("nnn",
    "asdftest", ...) mixed into the vendor sync alongside real user recipes — these aren't
    brewable recipes worth surfacing in the importer.

    The "test" check is a blunt substring match (any recipe with those 4 letters anywhere in
    its name, e.g. "StoutTest" or "saisontest"), so it will also drop the rare real name that
    happens to contain them, like "The Greatest American IPA" — accepted per user request to
    just keyword-filter on "test" rather than try to distinguish the two."""
    n = name.strip()
    if not n:
        return True
    compact = re.sub(r"[\s_-]", "", n)
    if not re.search(r"[a-zA-Z0-9]", n):
        return True
    if compact and len(set(compact.lower())) == 1:
        return True
    if len(compact) <= 2:
        return True
    if "test" in n.lower():
        return True
    if _KEYBOARD_MASH.fullmatch(compact):
        return True
    return False


def main() -> None:
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(SOURCE_DIR.glob("*.json"), key=lambda p: int(p.stem))

    index = []
    bad = 0
    empty = 0
    junk = 0
    for path in files:
        try:
            doc = json.loads(path.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError):
            bad += 1
            continue
        steps = doc.get("Steps")
        if not steps:
            empty += 1
            continue
        recipe_id = doc.get("PicoRecipeID")
        name = doc.get("Name")
        if recipe_id is None or not name:
            bad += 1
            continue
        if is_junk_name(name):
            junk += 1
            continue

        (DEST_DIR / path.name).write_text(json.dumps(doc, separators=(",", ":")))
        index.append({"id": recipe_id, "name": name, "abv": doc.get("Abv"), "ibu": doc.get("Ibu")})

    INDEX_PATH.write_text(json.dumps(index, separators=(",", ":")))
    print(f"Copied {len(index)} valid recipes ({bad} unparseable, {empty} with no steps, {junk} junk names) to {DEST_DIR}")
    print(f"Wrote index: {INDEX_PATH}")


if __name__ == "__main__":
    main()
