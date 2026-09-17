-- DropIndex
DROP INDEX "_RecipeToRecipeIngredient_B_index";

-- DropIndex
DROP INDEX "_RecipeToRecipeIngredient_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_RecipeToRecipeIngredient";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abv" REAL NOT NULL,
    "ibu" REAL NOT NULL,
    "style" TEXT,
    "og" REAL,
    "fg" REAL,
    "colorSRM" INTEGER,
    "fermentDays" INTEGER,
    "image" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "photoUrl" TEXT,
    "ogMin" REAL,
    "ogMax" REAL,
    "fgMin" REAL,
    "fgMax" REAL,
    "ibuMin" REAL,
    "ibuMax" REAL,
    "srmMin" REAL,
    "srmMax" REAL,
    "abvMin" REAL,
    "abvMax" REAL,
    "batchSize" REAL,
    "mashType" INTEGER,
    "boilTime" INTEGER,
    "boilTemp" INTEGER,
    "firstWortHopping" BOOLEAN NOT NULL DEFAULT false,
    "fermentationType" INTEGER,
    "yeastName" TEXT,
    "yeastAttenuation" REAL,
    "yeastRangeTemp" TEXT,
    "yeastPitchTemp" INTEGER
);
INSERT INTO "new_Recipe" ("abv", "colorSRM", "createdAt", "deletedAt", "deviceType", "fermentDays", "fg", "ibu", "id", "image", "name", "notes", "og", "style", "updatedAt") SELECT "abv", "colorSRM", "createdAt", "deletedAt", "deviceType", "fermentDays", "fg", "ibu", "id", "image", "name", "notes", "og", "style", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";

-- Carry the existing yeast ingredient row (Safale US-05, recipe 2) onto the new Recipe.yeastName field
UPDATE "Recipe" SET "yeastName" = 'Safale US-05' WHERE "id" = 2;

CREATE TABLE "new_RecipeIngredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeId" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT,
    "color" REAL,
    "aa" REAL,
    "time" INTEGER,
    "temp" INTEGER,
    "days" INTEGER,
    "hours" INTEGER,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Re-home the existing fermentable/hop/other-boil rows (all previously linked to recipe 2) into the new per-recipe shape
INSERT INTO "new_RecipeIngredient" ("recipeId", "section", "sortOrder", "name", "amount", "unit") VALUES
  (2, 'FERMENTABLE', 0, 'Pale 2-Row Malt', 8.0, 'lbs'),
  (2, 'FERMENTABLE', 1, 'Caramel 10L', 1.0, 'lb'),
  (2, 'BOIL_HOP', 0, 'Willamette', 2.0, 'oz'),
  (2, 'OTHER_BOIL', 0, 'Irish Moss', 0.125, 'oz'),
  (2, 'OTHER_BOIL', 1, 'Vanilla Flavoring', 4.0, 'oz');
DROP TABLE "RecipeIngredient";
ALTER TABLE "new_RecipeIngredient" RENAME TO "RecipeIngredient";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
