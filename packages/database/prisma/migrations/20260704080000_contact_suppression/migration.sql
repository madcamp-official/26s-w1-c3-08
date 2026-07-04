CREATE TABLE "ContactSuppression" (
    "id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "contactHash" CHAR(64) NOT NULL,
    "sourceMessageRecipientId" UUID,
    "reason" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactSuppression_channel_contactHash_key" ON "ContactSuppression"("channel", "contactHash");
CREATE INDEX "ContactSuppression_createdAt_idx" ON "ContactSuppression"("createdAt");
