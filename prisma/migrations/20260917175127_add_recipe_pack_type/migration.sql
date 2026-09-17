-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceType" TEXT NOT NULL,
    "packType" TEXT NOT NULL DEFAULT 'zpack',
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
INSERT INTO "new_Recipe" ("abv", "abvMax", "abvMin", "batchSize", "boilTemp", "boilTime", "colorSRM", "createdAt", "deletedAt", "deviceType", "fermentDays", "fermentationType", "fg", "fgMax", "fgMin", "firstWortHopping", "ibu", "ibuMax", "ibuMin", "id", "image", "mashType", "name", "notes", "og", "ogMax", "ogMin", "photoUrl", "srmMax", "srmMin", "style", "updatedAt", "yeastAttenuation", "yeastName", "yeastPitchTemp", "yeastRangeTemp") SELECT "abv", "abvMax", "abvMin", "batchSize", "boilTemp", "boilTime", "colorSRM", "createdAt", "deletedAt", "deviceType", "fermentDays", "fermentationType", "fg", "fgMax", "fgMin", "firstWortHopping", "ibu", "ibuMax", "ibuMin", "id", "image", "mashType", "name", "notes", "og", "ogMax", "ogMin", "photoUrl", "srmMax", "srmMin", "style", "updatedAt", "yeastAttenuation", "yeastName", "yeastPitchTemp", "yeastRangeTemp" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
