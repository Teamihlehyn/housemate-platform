-- Usability round 1 (ENG-50, 51, 58). Additive: notification targets, private conversation read state,
-- step-level funnel events (no personal data).
-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "ConversationRead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "step" TEXT,
    "stepIndex" INTEGER,
    "flowVersion" TEXT NOT NULL,
    "city" TEXT,
    "source" TEXT,
    "msBucket" TEXT,
    "countBucket" TEXT,
    "daysBucket" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationRead_conversationId_userId_key" ON "ConversationRead"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "FunnelEvent_event_createdAt_idx" ON "FunnelEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_funnelId_event_idx" ON "FunnelEvent"("funnelId", "event");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

