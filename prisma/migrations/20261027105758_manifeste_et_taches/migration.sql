-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Task_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "manifest" TEXT NOT NULL DEFAULT '',
    "endpointUrl" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceUnit" TEXT,
    CONSTRAINT "Agent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("authorId", "capabilities", "createdAt", "currency", "dependencies", "description", "downloadCount", "endpointUrl", "id", "inputs", "kind", "license", "llmModel", "name", "objective", "outputs", "priceCents", "priceUnit", "prompts", "protocol", "requirements", "runtime", "slug", "sourceUrl", "standalone", "status", "summary", "tools", "updatedAt", "usage") SELECT "authorId", "capabilities", "createdAt", "currency", "dependencies", "description", "downloadCount", "endpointUrl", "id", "inputs", "kind", "license", "llmModel", "name", "objective", "outputs", "priceCents", "priceUnit", "prompts", "protocol", "requirements", "runtime", "slug", "sourceUrl", "standalone", "status", "summary", "tools", "updatedAt", "usage" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");
CREATE INDEX "Agent_kind_status_createdAt_idx" ON "Agent"("kind", "status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Task_agentId_createdAt_idx" ON "Task"("agentId", "createdAt");
