ALTER TABLE "User"
  ADD COLUMN "signupPhoneVerificationRequiredAt" TIMESTAMPTZ(3),
  ADD COLUMN "signupPhoneVerificationCompletedAt" TIMESTAMPTZ(3);

CREATE INDEX "User_signupPhoneVerificationRequiredAt_idx"
  ON "User"("signupPhoneVerificationRequiredAt");
