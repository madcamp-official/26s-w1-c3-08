import {
  CommunicationBlockDirection,
  CommunicationBlockTargetType,
  Prisma,
  UserContactType,
} from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import {
  normalizeEmailContact,
  normalizeOptionalEmailContact,
  normalizeOptionalPhoneContact,
} from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";
import { hashContact } from "../../lib/tokens.js";
import type {
  CommunicationBlockDirectionInput,
  CreateCommunicationBlockInput,
} from "./communication-block.validation.js";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

type CommunicationContactReference = {
  type: "EMAIL" | "PHONE";
  contactHash: string;
};

export type CommunicationTargetReference = {
  userId?: string | null;
  contacts?: CommunicationContactReference[];
};

type CommunicationBlockMatch = NonNullable<Awaited<ReturnType<typeof findCommunicationBlock>>>;

export async function listCommunicationBlocks(userId: string, direction?: CommunicationBlockDirectionInput) {
  const blocks = await prisma.communicationBlock.findMany({
    where: {
      ownerUserId: userId,
      direction,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    blocks: blocks.map(mapCommunicationBlock),
  };
}

export async function createCommunicationBlock(userId: string, input: CreateCommunicationBlockInput) {
  const target = await normalizeBlockTarget(userId, input);
  const existing = await prisma.communicationBlock.findFirst({
    where: target.where,
  });

  if (existing) {
    return {
      block: mapCommunicationBlock(existing),
      created: false,
    };
  }

  try {
    const block = await prisma.communicationBlock.create({
      data: target.data,
    });

    return {
      block: mapCommunicationBlock(block),
      created: true,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const block = await prisma.communicationBlock.findFirst({
        where: target.where,
      });

      if (block) {
        return {
          block: mapCommunicationBlock(block),
          created: false,
        };
      }
    }

    throw error;
  }
}

export async function deleteCommunicationBlock(userId: string, blockId: string) {
  const block = await prisma.communicationBlock.findFirst({
    where: {
      id: blockId,
      ownerUserId: userId,
    },
    select: { id: true },
  });

  if (!block) {
    throw new AppError("COMMUNICATION_BLOCK_NOT_FOUND", "송수신 거부 설정을 찾지 못했어요.", 404);
  }

  await prisma.communicationBlock.delete({
    where: { id: block.id },
  });

  return { deleted: true };
}

export async function getUserCommunicationTarget(
  userId: string,
  client: PrismaClientLike = prisma,
): Promise<CommunicationTargetReference> {
  const contacts = await client.userContact.findMany({
    where: {
      userId,
      deletedAt: null,
      verifiedAt: {
        not: null,
      },
      type: {
        in: [UserContactType.EMAIL, UserContactType.PHONE],
      },
    },
    select: {
      type: true,
      contactHash: true,
    },
  });

  return {
    userId,
    contacts: contacts.map((contact) => ({
      type: contact.type === UserContactType.EMAIL ? CommunicationBlockTargetType.EMAIL : CommunicationBlockTargetType.PHONE,
      contactHash: contact.contactHash,
    })),
  };
}

export function getContactCommunicationTargets(input: {
  email?: string | null;
  phone?: string | null;
}): CommunicationContactReference[] {
  const contacts: CommunicationContactReference[] = [];
  const email = normalizeOptionalEmailContact(input.email);
  const phone = normalizeOptionalPhoneContact(input.phone);

  if (email) {
    contacts.push({
      type: CommunicationBlockTargetType.EMAIL,
      contactHash: hashContact(UserContactType.EMAIL, email),
    });
  }

  if (phone) {
    contacts.push({
      type: CommunicationBlockTargetType.PHONE,
      contactHash: hashContact(UserContactType.PHONE, phone),
    });
  }

  return contacts;
}

export function mergeCommunicationTargets(
  base: CommunicationTargetReference,
  extraContacts: CommunicationContactReference[],
): CommunicationTargetReference {
  const contactsByKey = new Map<string, CommunicationContactReference>();

  for (const contact of [...(base.contacts ?? []), ...extraContacts]) {
    contactsByKey.set(`${contact.type}:${contact.contactHash}`, contact);
  }

  return {
    userId: base.userId,
    contacts: [...contactsByKey.values()],
  };
}

export async function findCommunicationBlock(
  ownerUserId: string,
  direction: CommunicationBlockDirection,
  target: CommunicationTargetReference,
  client: PrismaClientLike = prisma,
) {
  const OR: Prisma.CommunicationBlockWhereInput[] = [];

  if (target.userId && target.userId !== ownerUserId) {
    OR.push({
      targetType: CommunicationBlockTargetType.USER,
      targetUserId: target.userId,
    });
  }

  for (const contact of target.contacts ?? []) {
    OR.push({
      targetType: contact.type,
      targetContactHash: contact.contactHash,
    });
  }

  if (OR.length === 0) {
    return null;
  }

  return client.communicationBlock.findFirst({
    where: {
      ownerUserId,
      direction,
      OR,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findCommunicationBlockBetweenUsers(
  actorUserId: string,
  targetUserId: string,
  client: PrismaClientLike = prisma,
) {
  if (actorUserId === targetUserId) {
    return null;
  }

  const actorTarget = await getUserCommunicationTarget(actorUserId, client);
  const targetTarget = await getUserCommunicationTarget(targetUserId, client);

  return (
    (await findCommunicationBlock(actorUserId, CommunicationBlockDirection.SEND_TO, targetTarget, client)) ??
    (await findCommunicationBlock(targetUserId, CommunicationBlockDirection.RECEIVE_FROM, actorTarget, client))
  );
}

export async function assertCommunicationAllowedBetweenUsers(
  actorUserId: string,
  targetUserId: string,
  options: {
    errorCode: string;
    message: string;
  },
  client: PrismaClientLike = prisma,
) {
  const block = await findCommunicationBlockBetweenUsers(actorUserId, targetUserId, client);

  if (block) {
    throwCommunicationBlocked(block, options.errorCode, options.message);
  }
}

export async function assertNoCommunicationBlockBetweenUsers(
  firstUserId: string,
  secondUserId: string,
  options: {
    errorCode: string;
    message: string;
  },
  client: PrismaClientLike = prisma,
) {
  if (firstUserId === secondUserId) {
    return;
  }

  const firstTarget = await getUserCommunicationTarget(firstUserId, client);
  const secondTarget = await getUserCommunicationTarget(secondUserId, client);
  const block =
    (await findCommunicationBlock(firstUserId, CommunicationBlockDirection.SEND_TO, secondTarget, client)) ??
    (await findCommunicationBlock(firstUserId, CommunicationBlockDirection.RECEIVE_FROM, secondTarget, client)) ??
    (await findCommunicationBlock(secondUserId, CommunicationBlockDirection.SEND_TO, firstTarget, client)) ??
    (await findCommunicationBlock(secondUserId, CommunicationBlockDirection.RECEIVE_FROM, firstTarget, client));

  if (block) {
    throwCommunicationBlocked(block, options.errorCode, options.message);
  }
}

export function mapCommunicationBlock(block: {
  id: string;
  direction: CommunicationBlockDirection;
  targetType: CommunicationBlockTargetType;
  targetUserId: string | null;
  targetDisplayName: string | null;
  targetMaskedValue: string | null;
  targetLabel: string | null;
  createdAt: Date;
}) {
  return {
    id: block.id,
    direction: block.direction,
    targetType: block.targetType,
    targetUserId: block.targetUserId,
    targetDisplayName: block.targetDisplayName,
    targetMaskedValue: block.targetMaskedValue,
    targetLabel: block.targetLabel,
    createdAt: block.createdAt,
  };
}

export function getCommunicationBlockDetails(block: CommunicationBlockMatch) {
  return {
    direction: block.direction,
    targetType: block.targetType,
    targetUserId: block.targetUserId,
    targetDisplayName: block.targetDisplayName,
    targetMaskedValue: block.targetMaskedValue,
    targetLabel: block.targetLabel,
  };
}

function throwCommunicationBlocked(block: CommunicationBlockMatch, errorCode: string, message: string): never {
  throw new AppError(errorCode, message, 409, {
    block: getCommunicationBlockDetails(block),
  });
}

async function normalizeBlockTarget(userId: string, input: CreateCommunicationBlockInput) {
  const direction = toBlockDirection(input.direction);

  if (input.target.type === "USER") {
    if (input.target.userId === userId) {
      throw new AppError("COMMUNICATION_BLOCK_SELF_NOT_ALLOWED", "내 계정은 송수신 거부 대상으로 등록할 수 없어요.", 400);
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: input.target.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        nickname: true,
      },
    });

    if (!targetUser) {
      throw new AppError("COMMUNICATION_BLOCK_TARGET_NOT_FOUND", "송수신 거부 대상을 찾지 못했어요.", 404);
    }

    return {
      where: {
        ownerUserId: userId,
        direction,
        targetType: CommunicationBlockTargetType.USER,
        targetUserId: targetUser.id,
      },
      data: {
        ownerUserId: userId,
        direction,
        targetType: CommunicationBlockTargetType.USER,
        targetUserId: targetUser.id,
        targetDisplayName: targetUser.nickname,
      },
    };
  }

  const targetType =
    input.target.type === "EMAIL" ? CommunicationBlockTargetType.EMAIL : CommunicationBlockTargetType.PHONE;
  const normalizedContact = normalizeContactTarget(input.target.type, input.target.value);
  const targetContactHash = hashContact(input.target.type === "EMAIL" ? UserContactType.EMAIL : UserContactType.PHONE, normalizedContact);
  const targetLabel = normalizeLabel(input.target.label);

  return {
    where: {
      ownerUserId: userId,
      direction,
      targetType,
      targetContactHash,
    },
    data: {
      ownerUserId: userId,
      direction,
      targetType,
      targetContactHash,
      targetMaskedValue: maskContact(targetType, normalizedContact),
      targetLabel,
    },
  };
}

function normalizeContactTarget(type: "EMAIL" | "PHONE", value: string) {
  if (type === "EMAIL") {
    return normalizeEmailContact(value);
  }

  const normalizedPhone = normalizeOptionalPhoneContact(value);

  if (!normalizedPhone) {
    throw new AppError("COMMUNICATION_BLOCK_TARGET_INVALID", "전화번호는 국내 번호 10~11자리로 입력해 주세요.", 400);
  }

  return normalizedPhone;
}

function toBlockDirection(direction: CommunicationBlockDirectionInput) {
  return direction === "SEND_TO" ? CommunicationBlockDirection.SEND_TO : CommunicationBlockDirection.RECEIVE_FROM;
}

function normalizeLabel(label?: string | null) {
  const value = label?.trim();
  return value && value.length > 0 ? value : null;
}

function maskContact(type: "EMAIL" | "PHONE", value: string) {
  if (type === CommunicationBlockTargetType.PHONE) {
    return value.length >= 7 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value;
  }

  const [rawLocalPart, domain] = value.split("@");
  const localPart = rawLocalPart ?? "";

  if (!domain || !localPart) {
    return value;
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
