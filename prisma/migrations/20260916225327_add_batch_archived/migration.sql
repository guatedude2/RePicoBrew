-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "recipeId" INTEGER,
    "phase" TEXT NOT NULL DEFAULT 'Brewing',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "carbMethod" TEXT,
    "carbDuration" REAL,
    "carbUnit" TEXT,
    "carbStartedAt" DATETIME,
    "carbStatus" TEXT,
    "carbExtendMinutes" INTEGER,
    "fermentDeviceId" INTEGER,
    CONSTRAINT "Batch_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Batch_fermentDeviceId_fkey" FOREIGN KEY ("fermentDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Batch" ("carbDuration", "carbExtendMinutes", "carbMethod", "carbStartedAt", "carbStatus", "carbUnit", "completedAt", "createdAt", "fermentDeviceId", "id", "name", "phase", "recipeId", "updatedAt") SELECT "carbDuration", "carbExtendMinutes", "carbMethod", "carbStartedAt", "carbStatus", "carbUnit", "completedAt", "createdAt", "fermentDeviceId", "id", "name", "phase", "recipeId", "updatedAt" FROM "Batch";
DROP TABLE "Batch";
ALTER TABLE "new_Batch" RENAME TO "Batch";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
