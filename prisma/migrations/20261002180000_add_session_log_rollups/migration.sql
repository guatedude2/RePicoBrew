-- CreateTable
CREATE TABLE "SessionLogMinute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "bucket" BIGINT NOT NULL,
    "lastTime" BIGINT NOT NULL,
    "n" INTEGER NOT NULL,
    "tempSum" REAL NOT NULL DEFAULT 0,
    "tempN" INTEGER NOT NULL DEFAULT 0,
    "tempMin" REAL,
    "tempMax" REAL,
    "gravitySum" REAL NOT NULL DEFAULT 0,
    "gravityN" INTEGER NOT NULL DEFAULT 0,
    "gravityMin" REAL,
    "gravityMax" REAL,
    "pressureSum" REAL NOT NULL DEFAULT 0,
    "pressureN" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SessionLogQuarterHour" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "bucket" BIGINT NOT NULL,
    "lastTime" BIGINT NOT NULL,
    "n" INTEGER NOT NULL,
    "tempSum" REAL NOT NULL DEFAULT 0,
    "tempN" INTEGER NOT NULL DEFAULT 0,
    "tempMin" REAL,
    "tempMax" REAL,
    "gravitySum" REAL NOT NULL DEFAULT 0,
    "gravityN" INTEGER NOT NULL DEFAULT 0,
    "gravityMin" REAL,
    "gravityMax" REAL,
    "pressureSum" REAL NOT NULL DEFAULT 0,
    "pressureN" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SessionLogHour" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "bucket" BIGINT NOT NULL,
    "lastTime" BIGINT NOT NULL,
    "n" INTEGER NOT NULL,
    "tempSum" REAL NOT NULL DEFAULT 0,
    "tempN" INTEGER NOT NULL DEFAULT 0,
    "tempMin" REAL,
    "tempMax" REAL,
    "gravitySum" REAL NOT NULL DEFAULT 0,
    "gravityN" INTEGER NOT NULL DEFAULT 0,
    "gravityMin" REAL,
    "gravityMax" REAL,
    "pressureSum" REAL NOT NULL DEFAULT 0,
    "pressureN" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionLogMinute_sessionId_bucket_key" ON "SessionLogMinute"("sessionId", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "SessionLogQuarterHour_sessionId_bucket_key" ON "SessionLogQuarterHour"("sessionId", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "SessionLogHour_sessionId_bucket_key" ON "SessionLogHour"("sessionId", "bucket");

-- CreateIndex
CREATE INDEX "SessionLog_sessionId_time_idx" ON "SessionLog"("sessionId", "time");


-- Backfill the rollups from the existing fermentation readings (SessionLog type 1). A reading's time is the "time" in
-- its JSON when present (what the charts plot), else the row's own timestamp, which older databases store as ms and
-- newer ones as ISO text. Gravity of 0 means "no gravity" (e.g. a PicoFerm) and is left out.
INSERT INTO "SessionLogMinute" ("sessionId", "bucket", "lastTime", "n", "tempSum", "tempN", "tempMin", "tempMax", "gravitySum", "gravityN", "gravityMin", "gravityMax", "pressureSum", "pressureN")
SELECT "sessionId", (t / 60000) * 60000, MAX(t), COUNT(*),
  COALESCE(SUM(temp), 0), COUNT(temp), MIN(temp), MAX(temp),
  COALESCE(SUM(gravity), 0), COUNT(gravity), MIN(gravity), MAX(gravity),
  COALESCE(SUM(pressure), 0), COUNT(pressure)
FROM (
  SELECT "sessionId",
    COALESCE(
      CAST(json_extract("data", '$.time') AS INTEGER),
      CASE typeof("time") WHEN 'integer' THEN "time" ELSE CAST(round((julianday("time") - 2440587.5) * 86400000) AS INTEGER) END
    ) AS t,
    json_extract("data", '$.temp') AS temp,
    CASE WHEN json_extract("data", '$.gravity') > 0 THEN json_extract("data", '$.gravity') END AS gravity,
    json_extract("data", '$.pressure') AS pressure
  FROM "SessionLog"
  WHERE "type" = 1
)
WHERE t IS NOT NULL
GROUP BY "sessionId", t / 60000;

INSERT INTO "SessionLogQuarterHour" ("sessionId", "bucket", "lastTime", "n", "tempSum", "tempN", "tempMin", "tempMax", "gravitySum", "gravityN", "gravityMin", "gravityMax", "pressureSum", "pressureN")
SELECT "sessionId", ("bucket" / 900000) * 900000, MAX("lastTime"), SUM("n"),
  SUM("tempSum"), SUM("tempN"), MIN("tempMin"), MAX("tempMax"),
  SUM("gravitySum"), SUM("gravityN"), MIN("gravityMin"), MAX("gravityMax"),
  SUM("pressureSum"), SUM("pressureN")
FROM "SessionLogMinute"
GROUP BY "sessionId", "bucket" / 900000;

INSERT INTO "SessionLogHour" ("sessionId", "bucket", "lastTime", "n", "tempSum", "tempN", "tempMin", "tempMax", "gravitySum", "gravityN", "gravityMin", "gravityMax", "pressureSum", "pressureN")
SELECT "sessionId", ("bucket" / 3600000) * 3600000, MAX("lastTime"), SUM("n"),
  SUM("tempSum"), SUM("tempN"), MIN("tempMin"), MAX("tempMax"),
  SUM("gravitySum"), SUM("gravityN"), MIN("gravityMin"), MAX("gravityMax"),
  SUM("pressureSum"), SUM("pressureN")
FROM "SessionLogMinute"
GROUP BY "sessionId", "bucket" / 3600000;
