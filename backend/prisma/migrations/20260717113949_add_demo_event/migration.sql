-- CreateTable
CREATE TABLE "DemoEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ref" TEXT,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoEvent_ref_idx" ON "DemoEvent"("ref");

-- CreateIndex
CREATE INDEX "DemoEvent_sessionId_idx" ON "DemoEvent"("sessionId");

-- CreateIndex
CREATE INDEX "DemoEvent_createdAt_idx" ON "DemoEvent"("createdAt");
