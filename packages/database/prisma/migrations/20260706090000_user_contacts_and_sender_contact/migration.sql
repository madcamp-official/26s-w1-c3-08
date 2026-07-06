CREATE TYPE "UserContactType" AS ENUM ('EMAIL', 'PHONE');

CREATE TYPE "UserContactVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');

ALTER TABLE "Message"
  ADD COLUMN "senderContactId" UUID,
  ADD COLUMN "senderContactSnapshot" JSONB;

CREATE TABLE "UserContact" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" "UserContactType" NOT NULL,
  "value" VARCHAR(255) NOT NULL,
  "contactHash" CHAR(64) NOT NULL,
  "label" VARCHAR(80),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMPTZ(3),
  "verificationSource" VARCHAR(40),
  "deletedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "UserContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserContactVerification" (
  "id" UUID NOT NULL,
  "userContactId" UUID NOT NULL,
  "codeHash" CHAR(64) NOT NULL,
  "status" "UserContactVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "UserContactVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserContact_type_contactHash_key" ON "UserContact"("type", "contactHash");
CREATE INDEX "UserContact_userId_type_deletedAt_idx" ON "UserContact"("userId", "type", "deletedAt");
CREATE INDEX "UserContact_userId_isPrimary_idx" ON "UserContact"("userId", "isPrimary");
CREATE INDEX "UserContact_verifiedAt_idx" ON "UserContact"("verifiedAt");
CREATE INDEX "UserContactVerification_userContactId_status_expiresAt_idx" ON "UserContactVerification"("userContactId", "status", "expiresAt");
CREATE INDEX "UserContactVerification_createdAt_idx" ON "UserContactVerification"("createdAt");
CREATE INDEX "Message_senderContactId_idx" ON "Message"("senderContactId");

ALTER TABLE "UserContact"
  ADD CONSTRAINT "UserContact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserContactVerification"
  ADD CONSTRAINT "UserContactVerification_userContactId_fkey"
  FOREIGN KEY ("userContactId") REFERENCES "UserContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderContactId_fkey"
  FOREIGN KEY ("senderContactId") REFERENCES "UserContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
