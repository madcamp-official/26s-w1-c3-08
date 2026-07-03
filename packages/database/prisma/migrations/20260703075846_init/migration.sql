-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BLOCKED', 'MODERATION_FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('SELF', 'OTHER');

-- CreateEnum
CREATE TYPE "RecipientDeliveryStatus" AS ENUM ('WAITING', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmotionTag" AS ENUM ('THANKS', 'CHEER', 'CELEBRATION', 'COMFORT', 'LONGING', 'LOVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ModerationAttemptStatus" AS ENUM ('APPROVED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'KAKAO_ALIMTALK', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('MESSAGE_SENT', 'ARRIVAL_HINT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "kakaoId" VARCHAR(64) NOT NULL,
    "nickname" VARCHAR(80) NOT NULL,
    "email" VARCHAR(255),
    "profileImageUrl" VARCHAR(2048),
    "onboardingNote" TEXT,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" TEXT NOT NULL,
    "emotionTag" "EmotionTag",
    "customEmotionTag" VARCHAR(40),
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "isSenderHidden" BOOLEAN NOT NULL DEFAULT false,
    "isDateHidden" BOOLEAN NOT NULL DEFAULT false,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "moderationAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "moderationLastCheckedAt" TIMESTAMPTZ(3),
    "moderationNextRetryAt" TIMESTAMPTZ(3),
    "moderationFailureReason" TEXT,
    "moderationFeedback" TEXT,
    "moderationBlockedCategories" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecipient" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "receiverUserId" UUID,
    "receiverType" "RecipientType" NOT NULL,
    "receiverName" VARCHAR(80),
    "receiverEmail" VARCHAR(255),
    "receiverPhone" VARCHAR(32),
    "receiverInfo" JSONB,
    "deliveryStatus" "RecipientDeliveryStatus" NOT NULL DEFAULT 'WAITING',
    "deliveredAt" TIMESTAMPTZ(3),
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAccessToken" (
    "id" UUID NOT NULL,
    "messageRecipientId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "tokenPreview" VARCHAR(12),
    "expiresAt" TIMESTAMPTZ(3),
    "firstOpenedAt" TIMESTAMPTZ(3),
    "lastOpenedAt" TIMESTAMPTZ(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "linkedUserId" UUID,
    "linkedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MessageAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(80) NOT NULL,
    "status" "ModerationAttemptStatus" NOT NULL,
    "inputHash" CHAR(64),
    "categories" JSONB,
    "categoryScores" JSONB,
    "feedback" TEXT,
    "errorCode" VARCHAR(120),
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "messageRecipientId" UUID NOT NULL,
    "eventType" "NotificationEventType" NOT NULL DEFAULT 'MESSAGE_SENT',
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" VARCHAR(160),
    "payload" JSONB,
    "errorCode" VARCHAR(120),
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMPTZ(3),
    "attemptedAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_status_scheduledAt_idx" ON "Message"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Message_status_moderationNextRetryAt_idx" ON "Message"("status", "moderationNextRetryAt");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageRecipient_messageId_idx" ON "MessageRecipient"("messageId");

-- CreateIndex
CREATE INDEX "MessageRecipient_receiverUserId_readAt_idx" ON "MessageRecipient"("receiverUserId", "readAt");

-- CreateIndex
CREATE INDEX "MessageRecipient_deliveryStatus_idx" ON "MessageRecipient"("deliveryStatus");

-- CreateIndex
CREATE INDEX "MessageRecipient_receiverEmail_idx" ON "MessageRecipient"("receiverEmail");

-- CreateIndex
CREATE INDEX "MessageRecipient_receiverPhone_idx" ON "MessageRecipient"("receiverPhone");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAccessToken_tokenHash_key" ON "MessageAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MessageAccessToken_messageRecipientId_idx" ON "MessageAccessToken"("messageRecipientId");

-- CreateIndex
CREATE INDEX "MessageAccessToken_linkedUserId_idx" ON "MessageAccessToken"("linkedUserId");

-- CreateIndex
CREATE INDEX "MessageAccessToken_expiresAt_idx" ON "MessageAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "MessageAccessToken_revokedAt_idx" ON "MessageAccessToken"("revokedAt");

-- CreateIndex
CREATE INDEX "ModerationLog_status_checkedAt_idx" ON "ModerationLog"("status", "checkedAt");

-- CreateIndex
CREATE INDEX "ModerationLog_messageId_checkedAt_idx" ON "ModerationLog"("messageId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationLog_messageId_attemptNo_key" ON "ModerationLog"("messageId", "attemptNo");

-- CreateIndex
CREATE INDEX "NotificationLog_messageRecipientId_channel_idx" ON "NotificationLog"("messageRecipientId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_status_scheduledAt_idx" ON "NotificationLog"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationLog_eventType_createdAt_idx" ON "NotificationLog"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAccessToken" ADD CONSTRAINT "MessageAccessToken_messageRecipientId_fkey" FOREIGN KEY ("messageRecipientId") REFERENCES "MessageRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAccessToken" ADD CONSTRAINT "MessageAccessToken_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_messageRecipientId_fkey" FOREIGN KEY ("messageRecipientId") REFERENCES "MessageRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
