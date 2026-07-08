-- CreateEnum
CREATE TYPE "CommunicationBlockDirection" AS ENUM ('SEND_TO', 'RECEIVE_FROM');

-- CreateEnum
CREATE TYPE "CommunicationBlockTargetType" AS ENUM ('USER', 'EMAIL', 'PHONE');

-- CreateTable
CREATE TABLE "CommunicationBlock" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "direction" "CommunicationBlockDirection" NOT NULL,
    "targetType" "CommunicationBlockTargetType" NOT NULL,
    "targetUserId" UUID,
    "targetContactHash" CHAR(64),
    "targetMaskedValue" VARCHAR(255),
    "targetLabel" VARCHAR(80),
    "targetDisplayName" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationBlock_owner_user_target_key" ON "CommunicationBlock"("ownerUserId", "direction", "targetType", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationBlock_owner_contact_target_key" ON "CommunicationBlock"("ownerUserId", "direction", "targetType", "targetContactHash");

-- CreateIndex
CREATE INDEX "CommunicationBlock_owner_direction_created_idx" ON "CommunicationBlock"("ownerUserId", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationBlock_target_user_direction_idx" ON "CommunicationBlock"("targetUserId", "direction");

-- CreateIndex
CREATE INDEX "CommunicationBlock_target_contact_direction_idx" ON "CommunicationBlock"("targetContactHash", "direction", "targetType");

-- AddForeignKey
ALTER TABLE "CommunicationBlock" ADD CONSTRAINT "CommunicationBlock_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationBlock" ADD CONSTRAINT "CommunicationBlock_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
