ALTER TABLE "Message" ADD COLUMN "senderDeletedAt" TIMESTAMPTZ(3);

ALTER TABLE "MessageRecipient" ADD COLUMN "receiverDeletedAt" TIMESTAMPTZ(3);

CREATE INDEX "Message_senderId_senderDeletedAt_idx" ON "Message"("senderId", "senderDeletedAt");

CREATE INDEX "MessageRecipient_receiverUserId_receiverDeletedAt_idx" ON "MessageRecipient"("receiverUserId", "receiverDeletedAt");
