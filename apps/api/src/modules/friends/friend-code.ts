import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createFriendCode() {
  const bytes = crypto.randomBytes(8);
  let value = "";

  for (const byte of bytes) {
    value += ALPHABET[byte % ALPHABET.length];
  }

  return value;
}

export async function createUniqueFriendCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const friendCode = createFriendCode();
    const existing = await prisma.user.findUnique({
      where: { friendCode },
      select: { id: true },
    });

    if (!existing) {
      return friendCode;
    }
  }

  throw new Error("Failed to create unique friend code");
}
