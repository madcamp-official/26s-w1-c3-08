-- AlterTable
ALTER TABLE "Message"
  ADD COLUMN "senderDisplayName" VARCHAR(80);

-- Backfill existing messages with the sender nickname snapshot.
UPDATE "Message"
SET "senderDisplayName" = "User"."nickname"
FROM "User"
WHERE "Message"."senderId" = "User"."id"
  AND "Message"."senderDisplayName" IS NULL;

-- AlterTable
ALTER TABLE "MessageReply"
  ADD COLUMN "authorUserId" UUID,
  ADD COLUMN "authorDeletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "NotificationLog"
  ADD COLUMN "readAt" TIMESTAMPTZ(3);

-- Existing in-app arrival notifications predate targetUserId. Fill it so
-- user-facing notification APIs can read older rows.
UPDATE "NotificationLog"
SET "targetUserId" = "MessageRecipient"."receiverUserId"
FROM "MessageRecipient"
WHERE "NotificationLog"."messageRecipientId" = "MessageRecipient"."id"
  AND "NotificationLog"."channel" = 'IN_APP'
  AND "NotificationLog"."targetUserId" IS NULL
  AND "MessageRecipient"."receiverUserId" IS NOT NULL;

UPDATE "NotificationLog"
SET "readAt" = "MessageRecipient"."readAt"
FROM "MessageRecipient"
WHERE "NotificationLog"."messageRecipientId" = "MessageRecipient"."id"
  AND "NotificationLog"."eventType" = 'MESSAGE_SENT'
  AND "NotificationLog"."channel" = 'IN_APP'
  AND "NotificationLog"."readAt" IS NULL
  AND "MessageRecipient"."readAt" IS NOT NULL;

UPDATE "NotificationLog"
SET "readAt" = "MessageReply"."senderReadAt"
FROM "MessageReply"
WHERE "NotificationLog"."messageReplyId" = "MessageReply"."id"
  AND "NotificationLog"."eventType" = 'REPLY_RECEIVED'
  AND "NotificationLog"."channel" = 'IN_APP'
  AND "NotificationLog"."readAt" IS NULL
  AND "MessageReply"."senderReadAt" IS NOT NULL;

-- CreateTable
CREATE TABLE "DailyLine" (
  "id" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "poemTitle" VARCHAR(120) NOT NULL,
  "poet" VARCHAR(80) NOT NULL,
  "sourceNote" VARCHAR(255),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "DailyLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLineSelection" (
  "date" VARCHAR(10) NOT NULL,
  "dailyLineId" UUID NOT NULL,
  "selectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyLineSelection_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "MessageReply_authorUserId_createdAt_idx" ON "MessageReply"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReply_authorDeletedAt_createdAt_idx" ON "MessageReply"("authorDeletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_targetUserId_readAt_createdAt_idx" ON "NotificationLog"("targetUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "DailyLine_isActive_sortOrder_idx" ON "DailyLine"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyLineSelection_dailyLineId_idx" ON "DailyLineSelection"("dailyLineId");

-- CreateIndex
CREATE INDEX "DailyLineSelection_selectedAt_idx" ON "DailyLineSelection"("selectedAt");

-- AddForeignKey
ALTER TABLE "MessageReply" ADD CONSTRAINT "MessageReply_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLineSelection" ADD CONSTRAINT "DailyLineSelection_dailyLineId_fkey" FOREIGN KEY ("dailyLineId") REFERENCES "DailyLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
