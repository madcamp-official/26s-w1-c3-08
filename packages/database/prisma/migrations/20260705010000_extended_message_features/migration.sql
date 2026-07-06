-- Extend scheduled messages with non-Kakao MVP features:
-- grouped recipients, attachment metadata, anonymous replies, themes,
-- random arrival windows, arrival hints, and recipient archiving.

CREATE TYPE "MessageArrivalMode" AS ENUM ('FIXED', 'RANDOM_WINDOW');

CREATE TYPE "MessageTheme" AS ENUM ('LAVENDER', 'MOSS', 'SUNSET', 'MIDNIGHT', 'PAPER');

CREATE TYPE "MessageReplyStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

ALTER TABLE "Message"
  ADD COLUMN "arrivalMode" "MessageArrivalMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "arrivalWindowStartAt" TIMESTAMPTZ(3),
  ADD COLUMN "arrivalWindowEndAt" TIMESTAMPTZ(3),
  ADD COLUMN "hintAt" TIMESTAMPTZ(3),
  ADD COLUMN "hintSentAt" TIMESTAMPTZ(3),
  ADD COLUMN "theme" "MessageTheme" NOT NULL DEFAULT 'LAVENDER',
  ADD COLUMN "isReplyEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MessageRecipient"
  ADD COLUMN "receiverArchivedAt" TIMESTAMPTZ(3);

CREATE TABLE "MessageAttachment" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "publicUrl" VARCHAR(2048) NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "originalName" VARCHAR(255),
  "mimeType" VARCHAR(80) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageReply" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "messageRecipientId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "senderDisplayName" VARCHAR(80),
  "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
  "status" "MessageReplyStatus" NOT NULL DEFAULT 'VISIBLE',
  "moderationInputHash" CHAR(64),
  "moderationCategories" JSONB,
  "hiddenAt" TIMESTAMPTZ(3),
  "hiddenReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "MessageReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_status_hintAt_idx" ON "Message"("status", "hintAt");
CREATE INDEX "MessageRecipient_receiverUserId_receiverArchivedAt_idx" ON "MessageRecipient"("receiverUserId", "receiverArchivedAt");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
CREATE INDEX "MessageAttachment_createdAt_idx" ON "MessageAttachment"("createdAt");
CREATE INDEX "MessageReply_messageId_createdAt_idx" ON "MessageReply"("messageId", "createdAt");
CREATE INDEX "MessageReply_messageRecipientId_createdAt_idx" ON "MessageReply"("messageRecipientId", "createdAt");
CREATE INDEX "MessageReply_status_createdAt_idx" ON "MessageReply"("status", "createdAt");

ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReply"
  ADD CONSTRAINT "MessageReply_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReply"
  ADD CONSTRAINT "MessageReply_messageRecipientId_fkey"
  FOREIGN KEY ("messageRecipientId") REFERENCES "MessageRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
