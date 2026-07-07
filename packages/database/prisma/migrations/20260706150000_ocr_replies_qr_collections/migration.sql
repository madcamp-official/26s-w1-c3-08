-- CreateEnum
CREATE TYPE "AttachmentOcrStatus" AS ENUM ('SKIPPED', 'EXTRACTED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'REPLY_RECEIVED';
ALTER TYPE "NotificationEventType" ADD VALUE 'COLLECTION_DELIVERED';

-- CreateEnum
CREATE TYPE "MessageCollectionStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MessageCollectionSubmissionStatus" AS ENUM ('VISIBLE', 'BLOCKED', 'HIDDEN', 'DELETED');

-- AlterTable
ALTER TABLE "MessageAttachment"
  ADD COLUMN "ocrStatus" "AttachmentOcrStatus" NOT NULL DEFAULT 'SKIPPED',
  ADD COLUMN "ocrText" TEXT,
  ADD COLUMN "ocrConfidence" DOUBLE PRECISION,
  ADD COLUMN "ocrError" TEXT,
  ADD COLUMN "ocrCheckedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "MessageReply"
  ADD COLUMN "senderReadAt" TIMESTAMPTZ(3),
  ADD COLUMN "senderDeletedAt" TIMESTAMPTZ(3),
  ADD COLUMN "notifiedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "NotificationLog"
  ALTER COLUMN "messageRecipientId" DROP NOT NULL,
  ADD COLUMN "targetUserId" UUID,
  ADD COLUMN "messageReplyId" UUID,
  ADD COLUMN "messageCollectionId" UUID;

-- CreateTable
CREATE TABLE "MessageCollection" (
  "id" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "tokenPreview" VARCHAR(12),
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "MessageCollectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "deliveredAt" TIMESTAMPTZ(3),
  "canceledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "MessageCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCollectionSubmission" (
  "id" UUID NOT NULL,
  "collectionId" UUID NOT NULL,
  "senderDisplayName" VARCHAR(80),
  "content" TEXT NOT NULL,
  "status" "MessageCollectionSubmissionStatus" NOT NULL DEFAULT 'VISIBLE',
  "moderationInputHash" CHAR(64),
  "moderationCategories" JSONB,
  "moderationFeedback" TEXT,
  "ipHash" CHAR(64) NOT NULL,
  "deliveredAt" TIMESTAMPTZ(3),
  "ownerReadAt" TIMESTAMPTZ(3),
  "hiddenAt" TIMESTAMPTZ(3),
  "hiddenReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "MessageCollectionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageCollection_tokenHash_key" ON "MessageCollection"("tokenHash");

-- CreateIndex
CREATE INDEX "MessageCollection_ownerId_status_scheduledAt_idx" ON "MessageCollection"("ownerId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MessageCollection_status_scheduledAt_idx" ON "MessageCollection"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MessageCollection_scheduledAt_idx" ON "MessageCollection"("scheduledAt");

-- CreateIndex
CREATE INDEX "MessageCollectionSubmission_collectionId_status_createdAt_idx" ON "MessageCollectionSubmission"("collectionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageCollectionSubmission_collectionId_ipHash_createdAt_idx" ON "MessageCollectionSubmission"("collectionId", "ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "MessageCollectionSubmission_status_createdAt_idx" ON "MessageCollectionSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageCollectionSubmission_ownerReadAt_createdAt_idx" ON "MessageCollectionSubmission"("ownerReadAt", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReply_senderDeletedAt_createdAt_idx" ON "MessageReply"("senderDeletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReply_senderReadAt_createdAt_idx" ON "MessageReply"("senderReadAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_targetUserId_eventType_createdAt_idx" ON "NotificationLog"("targetUserId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_messageReplyId_idx" ON "NotificationLog"("messageReplyId");

-- CreateIndex
CREATE INDEX "NotificationLog_messageCollectionId_idx" ON "NotificationLog"("messageCollectionId");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_messageReplyId_fkey" FOREIGN KEY ("messageReplyId") REFERENCES "MessageReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_messageCollectionId_fkey" FOREIGN KEY ("messageCollectionId") REFERENCES "MessageCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCollection" ADD CONSTRAINT "MessageCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCollectionSubmission" ADD CONSTRAINT "MessageCollectionSubmission_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MessageCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
