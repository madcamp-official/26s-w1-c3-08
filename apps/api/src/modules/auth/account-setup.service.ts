import { Prisma, UserContactType } from "@maeari/database";
import { isStrictKoreanMobilePhone } from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";

export type AccountSetupStatus = {
  hasVerifiedStrictPhone: boolean;
  requiresSignupPhoneVerification: boolean;
  hasCompletedOnboarding: boolean;
};

export async function getAccountSetupStatus(userId: string): Promise<AccountSetupStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingNote: true,
      signupPhoneVerificationRequiredAt: true,
      signupPhoneVerificationCompletedAt: true,
    },
  });

  const hasVerifiedStrictPhone = await hasVerifiedStrictPhoneContact(userId);

  return {
    hasVerifiedStrictPhone,
    requiresSignupPhoneVerification: Boolean(
      user?.signupPhoneVerificationRequiredAt &&
        !user.signupPhoneVerificationCompletedAt &&
        !hasVerifiedStrictPhone,
    ),
    hasCompletedOnboarding: user?.onboardingNote !== null && typeof user?.onboardingNote !== "undefined",
  };
}

export async function completeSignupPhoneVerificationIfRequired(
  tx: Prisma.TransactionClient,
  userId: string,
  completedAt: Date,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      signupPhoneVerificationRequiredAt: true,
      signupPhoneVerificationCompletedAt: true,
    },
  });

  if (!user?.signupPhoneVerificationRequiredAt || user.signupPhoneVerificationCompletedAt) {
    return;
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      signupPhoneVerificationCompletedAt: completedAt,
    },
  });
}

async function hasVerifiedStrictPhoneContact(userId: string) {
  const contacts = await prisma.userContact.findMany({
    where: {
      userId,
      type: UserContactType.PHONE,
      deletedAt: null,
      verifiedAt: {
        not: null,
      },
    },
    select: {
      value: true,
    },
  });

  return contacts.some((contact) => isStrictKoreanMobilePhone(contact.value));
}
