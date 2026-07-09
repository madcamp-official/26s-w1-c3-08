import { MessageStatus, RecipientType } from "@maeari/database";
import type { RecipientHistoryItem, RecipientHistoryResponse } from "@maeari/shared";
import { normalizeOptionalEmailContact, normalizeOptionalPhoneContact } from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";

const recipientHistoryCandidateLimit = 100;
const recipientHistoryResponseLimit = 12;

export async function listRecipientHistory(userId: string): Promise<RecipientHistoryResponse> {
  const candidates = await prisma.messageRecipient.findMany({
    where: {
      receiverType: RecipientType.OTHER,
      OR: [
        {
          receiverEmail: {
            not: null,
          },
        },
        {
          receiverPhone: {
            not: null,
          },
        },
      ],
      message: {
        senderId: userId,
        senderDeletedAt: null,
        status: {
          not: MessageStatus.CANCELED,
        },
      },
    },
    include: {
      message: {
        select: {
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: recipientHistoryCandidateLimit,
  });

  const recipients: RecipientHistoryItem[] = [];
  const recipientsByContactKey = new Map<string, RecipientHistoryItem>();

  for (const candidate of candidates) {
    const email = normalizeOptionalEmailContact(candidate.receiverEmail);
    const phone = normalizeOptionalPhoneContact(candidate.receiverPhone);
    const contactKeys = createContactKeys(email, phone);

    if (contactKeys.length === 0) {
      continue;
    }

    const existing = contactKeys.map((key) => recipientsByContactKey.get(key)).find((item): item is RecipientHistoryItem => Boolean(item));

    if (existing) {
      existing.sendCount += 1;

      for (const contactKey of contactKeys) {
        recipientsByContactKey.set(contactKey, existing);
      }

      continue;
    }

    const item: RecipientHistoryItem = {
      id: candidate.id,
      name: normalizeRecipientName(candidate.receiverName, email, phone),
      email,
      phone,
      maskedEmail: email ? maskEmail(email) : null,
      maskedPhone: phone ? maskPhone(phone) : null,
      preferredChannel: resolvePreferredChannel(candidate.receiverInfo, email, phone),
      lastUsedAt: candidate.message.createdAt.toISOString(),
      sendCount: 1,
    };

    recipients.push(item);

    for (const contactKey of contactKeys) {
      recipientsByContactKey.set(contactKey, item);
    }
  }

  return {
    recipients: recipients.slice(0, recipientHistoryResponseLimit),
  };
}

function createContactKeys(email: string | null, phone: string | null) {
  const keys: string[] = [];

  if (email) {
    keys.push(`EMAIL:${email}`);
  }

  if (phone) {
    keys.push(`PHONE:${phone}`);
  }

  return keys;
}

function normalizeRecipientName(name: string | null, email: string | null, phone: string | null) {
  const normalized = name?.trim();

  if (normalized) {
    return normalized.slice(0, 80);
  }

  return maskEmail(email ?? "") || maskPhone(phone ?? "") || "연락처";
}

function resolvePreferredChannel(
  receiverInfo: unknown,
  email: string | null,
  phone: string | null,
): RecipientHistoryItem["preferredChannel"] {
  const preferredChannel = getPreferredChannelFromReceiverInfo(receiverInfo);

  if (preferredChannel) {
    return preferredChannel;
  }

  if (email && phone) {
    return "AUTO";
  }

  if (email) {
    return "EMAIL";
  }

  return "SMS";
}

function getPreferredChannelFromReceiverInfo(receiverInfo: unknown): RecipientHistoryItem["preferredChannel"] | null {
  if (!receiverInfo || typeof receiverInfo !== "object" || Array.isArray(receiverInfo)) {
    return null;
  }

  const value = (receiverInfo as { preferredChannel?: unknown }).preferredChannel;

  return value === "AUTO" || value === "EMAIL" || value === "SMS" ? value : null;
}

function maskEmail(value: string) {
  const [rawLocalPart, rawDomain] = value.split("@");
  const localPart = rawLocalPart ?? "";
  const domain = rawDomain ?? "";

  if (!localPart || !domain) {
    return value || null;
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function maskPhone(value: string) {
  if (!value) {
    return null;
  }

  return value.length >= 7 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value;
}
