CREATE TABLE "FriendInviteLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inviterId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "tokenPreview" VARCHAR(12),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "maxClaims" INTEGER NOT NULL DEFAULT 1,
  "claimCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "FriendInviteLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendInviteLink_tokenHash_key" ON "FriendInviteLink"("tokenHash");
CREATE INDEX "FriendInviteLink_inviterId_createdAt_idx" ON "FriendInviteLink"("inviterId", "createdAt");
CREATE INDEX "FriendInviteLink_expiresAt_idx" ON "FriendInviteLink"("expiresAt");
CREATE INDEX "FriendInviteLink_revokedAt_idx" ON "FriendInviteLink"("revokedAt");

ALTER TABLE "FriendInviteLink"
  ADD CONSTRAINT "FriendInviteLink_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
