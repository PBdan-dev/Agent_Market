-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "objective" TEXT NOT NULL DEFAULT '',
    "capabilities" TEXT NOT NULL DEFAULT '',
    "tools" TEXT NOT NULL DEFAULT '',
    "llmModel" TEXT NOT NULL DEFAULT '',
    "prompts" TEXT NOT NULL DEFAULT '',
    "runtime" TEXT NOT NULL DEFAULT '',
    "protocol" TEXT NOT NULL DEFAULT '',
    "standalone" BOOLEAN NOT NULL DEFAULT false,
    "dependencies" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "usage" TEXT NOT NULL DEFAULT '',
    "inputs" TEXT NOT NULL DEFAULT '',
    "outputs" TEXT NOT NULL DEFAULT '',
    "license" TEXT,
    "sourceUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "endpointUrl" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceUnit" TEXT,
    CONSTRAINT "Agent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("authorId", "createdAt", "currency", "description", "downloadCount", "endpointUrl", "id", "kind", "license", "name", "priceCents", "priceUnit", "slug", "sourceUrl", "status", "summary", "updatedAt") SELECT "authorId", "createdAt", "currency", "description", "downloadCount", "endpointUrl", "id", "kind", "license", "name", "priceCents", "priceUnit", "slug", "sourceUrl", "status", "summary", "updatedAt" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");
CREATE INDEX "Agent_kind_status_createdAt_idx" ON "Agent"("kind", "status", "createdAt");
CREATE TABLE "new_AgentFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "entries" TEXT NOT NULL DEFAULT '',
    "hasManifest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentFile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentFile" ("agentId", "createdAt", "extension", "id", "sha256", "sizeBytes", "storageKey", "version") SELECT "agentId", "createdAt", "extension", "id", "sha256", "sizeBytes", "storageKey", "version" FROM "AgentFile";
DROP TABLE "AgentFile";
ALTER TABLE "new_AgentFile" RENAME TO "AgentFile";
CREATE UNIQUE INDEX "AgentFile_storageKey_key" ON "AgentFile"("storageKey");
CREATE UNIQUE INDEX "AgentFile_agentId_version_key" ON "AgentFile"("agentId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
