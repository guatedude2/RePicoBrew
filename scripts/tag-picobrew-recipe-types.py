#!/usr/bin/env python3
"""Tags every recipe file in data/picobrew-recipes/recipes/ with a "Type": "Z-Pack" field
(inside VM.Recipe, alongside PicoBrew's own RecipeType/ZKit fields).

Why: every recipe in this dataset ships full brew-science data (fermentables, hops, yeast,
mash steps) alongside its machine steps, matching this app's "ZPack (Advanced)" format —
none of it is the steps-only "PicoPack" format, since none of the source recipes are missing
that brew-science data. This script makes that explicit in the data itself instead of relying
solely on app/routes/api.picobrew-recipes.ts hardcoding packType at import time.

Re-run this after re-syncing data/picobrew-recipes/ from the source repo (see PLAN.md).
"""

import json
import pathlib

RECIPES_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "picobrew-recipes" / "recipes"


def main() -> None:
    files = sorted(RECIPES_DIR.glob("*.json"))
    if not files:
        raise SystemExit(f"No recipe files found under {RECIPES_DIR}")

    tagged = 0
    for path in files:
        doc = json.loads(path.read_text())
        recipe = doc.get("VM", {}).get("Recipe")
        if recipe is None:
            print(f"skip (no VM.Recipe): {path.name}")
            continue
        recipe["Type"] = "Z-Pack"
        # Minified, matching the source files' own formatting (no pretty-print diff noise).
        path.write_text(json.dumps(doc, separators=(",", ":")))
        tagged += 1

    print(f"Tagged {tagged}/{len(files)} recipe files with Type=Z-Pack")


if __name__ == "__main__":
    main()
