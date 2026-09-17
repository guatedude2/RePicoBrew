-- CreateTable
CREATE TABLE "DiscoveredDevice" (
    "uid" TEXT NOT NULL PRIMARY KEY,
    "deviceType" TEXT,
    "metadata" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
