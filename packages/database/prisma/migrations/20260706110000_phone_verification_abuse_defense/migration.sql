CREATE TYPE "PhoneVerificationAttemptStatus" AS ENUM ('REQUESTED', 'SENT', 'BLOCKED', 'SEND_FAILED');

CREATE TYPE "PhoneVerificationLockScope" AS ENUM ('IP', 'CONTACT');

CREATE TABLE "PhoneVerificationAttempt" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "ipHash" CHAR(64) NOT NULL,
  "contactHash" CHAR(64) NOT NULL,
  "status" "PhoneVerificationAttemptStatus" NOT NULL,
  "reason" VARCHAR(120),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PhoneVerificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhoneVerificationLock" (
  "id" UUID NOT NULL,
  "scope" "PhoneVerificationLockScope" NOT NULL,
  "scopeHash" CHAR(64) NOT NULL,
  "reason" VARCHAR(120) NOT NULL,
  "lockedUntil" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "PhoneVerificationLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhoneNumberLookupCache" (
  "provider" VARCHAR(40) NOT NULL,
  "contactHash" CHAR(64) NOT NULL,
  "valid" BOOLEAN NOT NULL,
  "lineType" VARCHAR(40) NOT NULL,
  "carrierName" VARCHAR(120),
  "allowed" BOOLEAN NOT NULL,
  "reason" VARCHAR(120),
  "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "PhoneNumberLookupCache_pkey" PRIMARY KEY ("provider", "contactHash")
);

CREATE INDEX "PhoneVerificationAttempt_ipHash_createdAt_idx" ON "PhoneVerificationAttempt"("ipHash", "createdAt");
CREATE INDEX "PhoneVerificationAttempt_contactHash_createdAt_idx" ON "PhoneVerificationAttempt"("contactHash", "createdAt");
CREATE INDEX "PhoneVerificationAttempt_status_createdAt_idx" ON "PhoneVerificationAttempt"("status", "createdAt");
CREATE UNIQUE INDEX "PhoneVerificationLock_scope_scopeHash_key" ON "PhoneVerificationLock"("scope", "scopeHash");
CREATE INDEX "PhoneVerificationLock_lockedUntil_idx" ON "PhoneVerificationLock"("lockedUntil");
CREATE INDEX "PhoneNumberLookupCache_expiresAt_idx" ON "PhoneNumberLookupCache"("expiresAt");

UPDATE "UserContact"
SET "deletedAt" = CURRENT_TIMESTAMP,
    "isPrimary" = false
WHERE "type" = 'PHONE'
  AND "deletedAt" IS NULL
  AND "verifiedAt" IS NOT NULL;
