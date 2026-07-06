CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

ALTER TABLE "User"
  ADD COLUMN "suspendedAt" TIMESTAMPTZ(3),
  ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "MessageReport" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "messageRecipientId" UUID,
  "reporterUserId" UUID,
  "reason" VARCHAR(80) NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageReport_messageId_createdAt_idx" ON "MessageReport"("messageId", "createdAt");
CREATE INDEX "MessageReport_messageRecipientId_idx" ON "MessageReport"("messageRecipientId");
CREATE INDEX "MessageReport_reporterUserId_idx" ON "MessageReport"("reporterUserId");
CREATE INDEX "MessageReport_status_createdAt_idx" ON "MessageReport"("status", "createdAt");

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_messageRecipientId_fkey"
  FOREIGN KEY ("messageRecipientId") REFERENCES "MessageRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
