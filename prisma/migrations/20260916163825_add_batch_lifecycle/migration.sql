-- CreateTable
CREATE TABLE "Batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "recipeId" INTEGER,
    "phase" TEXT NOT NULL DEFAULT 'Brewing',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "carbMethod" TEXT,
    "carbDuration" REAL,
    "carbUnit" TEXT,
    "carbStartedAt" DATETIME,
    "carbStatus" TEXT,
    "carbExtendMinutes" INTEGER,
    CONSTRAINT "Batch_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "recipeId" INTEGER,
    "batchId" INTEGER,
    "state" INTEGER NOT NULL,
    "statusText" TEXT NOT NULL,
    "timeRemaining" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "deviceId", "id", "recipeId", "state", "statusText", "timeRemaining", "type", "uid", "updatedAt") SELECT "createdAt", "deviceId", "id", "recipeId", "state", "statusText", "timeRemaining", "type", "uid", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_uid_key" ON "Session"("uid");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
