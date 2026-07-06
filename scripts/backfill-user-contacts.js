#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
loadEnv();

let PrismaClient;
try {
  ({ PrismaClient } = require("../packages/database/generated/client"));
} catch (error) {
  console.error("Prisma Client를 불러오지 못했어요. 먼저 `pnpm db:generate`를 실행해 주세요.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const shouldShowHelp = args.has("--help") || args.has("-h");

if (shouldShowHelp) {
  console.log(`Usage: node scripts/backfill-user-contacts.js [--dry-run|--apply]

Options:
  --dry-run   Analyze users/messages without writing data. This is the default.
  --apply     Create/update UserContact rows and backfill Message.senderContactId.
`);
  process.exit(0);
}

const prisma = new PrismaClient({ log: ["error"] });

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  requireEnv("DATABASE_URL");
  requireEnv("PUBLIC_TOKEN_PEPPER");

  const mode = shouldApply ? "apply" : "dry-run";
  const now = new Date();
  const summary = {
    mode,
    usersScanned: 0,
    missingEmail: 0,
    skippedDuplicateEmail: 0,
    skippedExistingOwnerConflict: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsUnchanged: 0,
    messagesBackfilled: 0,
    messagesSkippedNoContact: 0,
  };

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  summary.usersScanned = users.length;

  const candidates = users.flatMap((user) => {
    const normalizedEmail = normalizeEmail(user.email);

    if (!normalizedEmail) {
      summary.missingEmail += 1;
      return [];
    }

    const contactHash = hashContact("EMAIL", normalizedEmail);
    return [
      {
        userId: user.id,
        normalizedEmail,
        contactHash,
        maskedEmail: maskEmail(normalizedEmail),
      },
    ];
  });

  const duplicateKeys = findDuplicateContactKeys(candidates);
  const validCandidates = [];

  for (const candidate of candidates) {
    const duplicateReason = duplicateKeys.get(candidate.contactHash);

    if (duplicateReason) {
      summary.skippedDuplicateEmail += 1;
      logSkip("SKIPPED_DUPLICATE_EMAIL", candidate, duplicateReason);
      continue;
    }

    validCandidates.push(candidate);
  }

  const hasUserContactTable = await tableExists("UserContact");
  const hasSenderContactColumns =
    (await columnExists("Message", "senderContactId")) && (await columnExists("Message", "senderContactSnapshot"));

  if (!hasUserContactTable || !hasSenderContactColumns) {
    console.log("UserContact table 또는 Message senderContact column이 아직 없습니다.");
    console.log("대상 DB에 `pnpm db:deploy`를 먼저 적용한 뒤 --apply를 실행하세요.");
    printSummary(summary);

    if (shouldApply) {
      process.exitCode = 1;
    }

    return;
  }

  const contactByUserId = new Map();

  for (const candidate of validCandidates) {
    const existing = await prisma.userContact.findUnique({
      where: {
        type_contactHash: {
          type: "EMAIL",
          contactHash: candidate.contactHash,
        },
      },
    });

    if (existing && existing.userId !== candidate.userId) {
      summary.skippedExistingOwnerConflict += 1;
      logSkip("SKIPPED_EXISTING_OWNER_CONFLICT", candidate, `owner=${existing.userId}`);
      continue;
    }

    const primaryContact = await prisma.userContact.findFirst({
      where: {
        userId: candidate.userId,
        deletedAt: null,
        isPrimary: true,
      },
      select: { id: true },
    });
    const snapshot = createSenderContactSnapshot(candidate);

    if (existing) {
      const updateData = {
        value: candidate.normalizedEmail,
        deletedAt: null,
        verifiedAt: existing.verifiedAt ?? now,
        verificationSource: existing.verificationSource ?? "KAKAO",
        label: existing.label ?? "카카오 이메일",
        isPrimary: existing.isPrimary || !primaryContact,
      };

      if (shouldApply) {
        const updated = await prisma.userContact.update({
          where: { id: existing.id },
          data: updateData,
        });
        contactByUserId.set(candidate.userId, {
          id: updated.id,
          snapshot: createSenderContactSnapshotFromContact(updated),
        });
      } else {
        contactByUserId.set(candidate.userId, {
          id: existing.id,
          snapshot,
        });
      }

      if (needsContactUpdate(existing, updateData)) {
        summary.contactsUpdated += 1;
      } else {
        summary.contactsUnchanged += 1;
      }

      continue;
    }

    if (shouldApply) {
      const created = await prisma.userContact.create({
        data: {
          userId: candidate.userId,
          type: "EMAIL",
          value: candidate.normalizedEmail,
          contactHash: candidate.contactHash,
          label: "카카오 이메일",
          isPrimary: !primaryContact,
          verifiedAt: now,
          verificationSource: "KAKAO",
        },
      });
      contactByUserId.set(candidate.userId, {
        id: created.id,
        snapshot: createSenderContactSnapshotFromContact(created),
      });
    } else {
      contactByUserId.set(candidate.userId, {
        id: "__dry_run_new_contact__",
        snapshot,
      });
    }

    summary.contactsCreated += 1;
  }

  const messages = await prisma.message.findMany({
    where: {
      senderContactId: null,
    },
    select: {
      id: true,
      senderId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const message of messages) {
    const contact = contactByUserId.get(message.senderId);

    if (!contact) {
      summary.messagesSkippedNoContact += 1;
      continue;
    }

    if (shouldApply) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          senderContactId: contact.id,
          senderContactSnapshot: contact.snapshot,
        },
      });
    }

    summary.messagesBackfilled += 1;
  }

  printSummary(summary);
}

function loadEnv() {
  const shellEnv = { ...process.env };
  const env = {};

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(rootDir, fileName);

    if (fs.existsSync(filePath)) {
      Object.assign(env, dotenv.parse(fs.readFileSync(filePath)));
    }
  }

  Object.assign(process.env, env, shellEnv);
}

function requireEnv(key) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function normalizeEmail(email) {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

function hashContact(channel, normalizedContact) {
  return crypto
    .createHmac("sha256", process.env.PUBLIC_TOKEN_PEPPER)
    .update(`${channel}:${normalizedContact}`)
    .digest("hex");
}

function findDuplicateContactKeys(candidates) {
  const byHash = new Map();

  for (const candidate of candidates) {
    const item = byHash.get(candidate.contactHash) ?? {
      maskedEmail: candidate.maskedEmail,
      userIds: [],
    };
    item.userIds.push(candidate.userId);
    byHash.set(candidate.contactHash, item);
  }

  const duplicates = new Map();

  for (const [contactHash, item] of byHash.entries()) {
    const uniqueUserIds = [...new Set(item.userIds)];

    if (uniqueUserIds.length > 1) {
      duplicates.set(contactHash, `${item.maskedEmail}, users=${uniqueUserIds.join(",")}`);
    }
  }

  return duplicates;
}

async function tableExists(tableName) {
  const result = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return Boolean(result[0]?.exists);
}

async function columnExists(tableName, columnName) {
  const result = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `;

  return Boolean(result[0]?.exists);
}

function needsContactUpdate(existing, next) {
  return (
    existing.value !== next.value ||
    existing.deletedAt !== next.deletedAt ||
    !existing.verifiedAt ||
    !existing.verificationSource ||
    !existing.label ||
    existing.isPrimary !== next.isPrimary
  );
}

function createSenderContactSnapshot(candidate) {
  return {
    type: "EMAIL",
    maskedValue: candidate.maskedEmail,
    contactHash: candidate.contactHash,
    label: "카카오 이메일",
  };
}

function createSenderContactSnapshotFromContact(contact) {
  return {
    type: contact.type,
    maskedValue: contact.type === "PHONE" ? maskPhone(contact.value) : maskEmail(contact.value),
    contactHash: contact.contactHash,
    label: contact.label,
  };
}

function maskEmail(email) {
  const [localPart = "", domain] = email.split("@");

  if (!localPart || !domain) {
    return "***";
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function maskPhone(phone) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

function logSkip(reason, candidate, detail) {
  console.log(`[${reason}] user=${candidate.userId} email=${candidate.maskedEmail} detail=${detail}`);
}

function printSummary(summary) {
  console.log("Backfill summary");
  console.log(JSON.stringify(summary, null, 2));
}
