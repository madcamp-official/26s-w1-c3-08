import { FriendRequestStatus } from "@maeari/database";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashPublicToken } from "../../lib/tokens.js";
import { assertNoCommunicationBlockBetweenUsers } from "../communication-blocks/communication-block.service.js";
import type { CreateFriendRequestInput } from "./friend.validation.js";

const FRIEND_REQUEST_TTL_DAYS = 14;
const FRIEND_INVITE_TTL_HOURS = 24;

export async function listFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      deletedAt: null,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
      userB: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return friendships.map((friendship) => {
    const friend = friendship.userAId === userId ? friendship.userB : friendship.userA;

    return {
      friendshipId: friendship.id,
      userId: friend.id,
      nickname: friend.nickname,
      profileImageUrl: friend.profileImageUrl,
      createdAt: friendship.createdAt,
    };
  });
}

export async function listFriendRequests(userId: string) {
  const [received, sent] = await Promise.all([
    prisma.friendRequest.findMany({
      where: {
        addresseeId: userId,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        requester: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: {
        requesterId: userId,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        addressee: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    received: received.map((request) => ({
      id: request.id,
      message: request.message,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      requester: request.requester,
    })),
    sent: sent.map((request) => ({
      id: request.id,
      message: request.message,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      addressee: request.addressee,
    })),
  };
}

export async function searchFriendCandidates(userId: string, query: string) {
  const keyword = query.trim();

  if (keyword.length < 2) {
    return [];
  }

  const upperKeyword = keyword.toUpperCase();
  const [friendships, pendingRequests] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        deletedAt: null,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: {
        userAId: true,
        userBId: true,
      },
    }),
    prisma.friendRequest.findMany({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requesterId: true,
        addresseeId: true,
      },
    }),
  ]);
  const excludedIds = new Set<string>([userId]);

  for (const friendship of friendships) {
    excludedIds.add(friendship.userAId === userId ? friendship.userBId : friendship.userAId);
  }

  for (const request of pendingRequests) {
    excludedIds.add(request.requesterId === userId ? request.addresseeId : request.requesterId);
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...excludedIds],
      },
      deletedAt: null,
      suspendedAt: null,
      OR: [
        {
          friendCode: upperKeyword,
        },
        {
          nickname: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      nickname: true,
      friendCode: true,
      profileImageUrl: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  return users.map((user) => ({
    userId: user.id,
    nickname: user.nickname,
    friendCode: user.friendCode,
    profileImageUrl: user.profileImageUrl,
  }));
}

export async function createFriendRequest(userId: string, input: CreateFriendRequestInput) {
  const friendCode = input.friendCode.trim().toUpperCase();
  const addressee = await prisma.user.findUnique({
    where: { friendCode },
    select: {
      id: true,
      nickname: true,
      profileImageUrl: true,
    },
  });

  if (!addressee) {
    throw new AppError("FRIEND_CODE_NOT_FOUND", "입력한 친구 코드를 찾지 못했어요.", 404);
  }

  if (addressee.id === userId) {
    throw new AppError("FRIEND_SELF_NOT_ALLOWED", "내 친구 코드는 직접 추가할 수 없어요.", 400);
  }

  const pair = friendshipPair(userId, addressee.id);
  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: pair,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (friendship && !friendship.deletedAt) {
    throw new AppError("FRIENDSHIP_ALREADY_EXISTS", "이미 친구로 연결된 사용자예요.", 409);
  }

  const pendingRequest = await prisma.friendRequest.findFirst({
    where: {
      status: FriendRequestStatus.PENDING,
      OR: [
        {
          requesterId: userId,
          addresseeId: addressee.id,
        },
        {
          requesterId: addressee.id,
          addresseeId: userId,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (pendingRequest) {
    throw new AppError("FRIEND_REQUEST_ALREADY_PENDING", "이미 보낸 친구 요청이 있어요.", 409);
  }

  await assertNoCommunicationBlockBetweenUsers(userId, addressee.id, {
    errorCode: "FRIEND_COMMUNICATION_BLOCKED",
    message: "송수신 거부 설정으로 친구 요청을 보낼 수 없어요.",
  });

  const request = await prisma.friendRequest.create({
    data: {
      requesterId: userId,
      addresseeId: addressee.id,
      message: normalizeOptional(input.message),
      expiresAt: new Date(Date.now() + FRIEND_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    include: {
      addressee: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return {
    id: request.id,
    message: request.message,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    addressee: request.addressee,
  };
}

export async function createFriendInviteLink(userId: string) {
  const rawToken = createPublicToken();
  const invite = await prisma.friendInviteLink.create({
    data: {
      inviterId: userId,
      tokenHash: hashPublicToken(rawToken),
      tokenPreview: createTokenPreview(rawToken),
      expiresAt: new Date(Date.now() + FRIEND_INVITE_TTL_HOURS * 60 * 60 * 1000),
      maxClaims: 1,
    },
    include: {
      inviter: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return {
    invite: mapInvite(invite),
    inviteUrl: toFriendInviteUrl(rawToken),
  };
}

export async function listActiveFriendInviteLinks(userId: string) {
  const invites = await prisma.friendInviteLink.findMany({
    where: {
      inviterId: userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      inviter: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return invites.filter((invite) => invite.claimCount < invite.maxClaims).map(mapInvite);
}

export async function revokeFriendInviteLink(userId: string, inviteId: string) {
  const invite = await prisma.friendInviteLink.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      inviterId: true,
      revokedAt: true,
    },
  });

  if (!invite) {
    throw new AppError("FRIEND_INVITE_NOT_FOUND", "친구 초대 링크를 찾지 못했어요.", 404);
  }

  if (invite.inviterId !== userId) {
    throw new AppError("FRIEND_INVITE_FORBIDDEN", "이 초대 링크를 관리할 권한이 없어요.", 403);
  }

  if (!invite.revokedAt) {
    await prisma.friendInviteLink.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });
  }

  return { revoked: true };
}

export async function previewFriendInviteLink(rawToken: string) {
  const invite = await findInviteByRawToken(rawToken);

  if (!invite) {
    throw new AppError("FRIEND_INVITE_NOT_FOUND", "친구 초대 링크를 찾지 못했어요.", 404);
  }

  return {
    invite: mapInvite(invite),
    availability: getInviteAvailability(invite),
  };
}

export async function claimFriendInviteLink(userId: string, rawToken: string) {
  const now = new Date();
  const tokenHash = hashPublicToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const invite = await tx.friendInviteLink.findUnique({
      where: { tokenHash },
      include: {
        inviter: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!invite) {
      throw new AppError("FRIEND_INVITE_NOT_FOUND", "친구 초대 링크를 찾지 못했어요.", 404);
    }

    if (invite.inviterId === userId) {
      throw new AppError("FRIEND_INVITE_SELF_NOT_ALLOWED", "내 초대 링크로는 친구를 추가할 수 없어요.", 400);
    }

    assertInviteClaimable(invite, now);

    const pair = friendshipPair(invite.inviterId, userId);
    const existing = await tx.friendship.findUnique({
      where: {
        userAId_userBId: pair,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (existing && !existing.deletedAt) {
      return {
        friendshipId: existing.id,
        alreadyFriend: true,
        inviter: invite.inviter,
      };
    }

    await assertNoCommunicationBlockBetweenUsers(
      invite.inviterId,
      userId,
      {
        errorCode: "FRIEND_COMMUNICATION_BLOCKED",
        message: "송수신 거부 설정으로 친구를 추가할 수 없어요.",
      },
      tx,
    );

    const consumed = await tx.friendInviteLink.updateMany({
      where: {
        id: invite.id,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
        claimCount: {
          lt: invite.maxClaims,
        },
      },
      data: {
        claimCount: {
          increment: 1,
        },
      },
    });

    if (consumed.count !== 1) {
      throw new AppError("FRIEND_INVITE_ALREADY_USED", "이미 사용된 친구 초대 링크예요.", 409);
    }

    const friendship = existing
      ? await tx.friendship.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            createdById: invite.inviterId,
          },
        })
      : await tx.friendship.create({
          data: {
            ...pair,
            createdById: invite.inviterId,
          },
        });

    await tx.friendRequest.updateMany({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [
          { requesterId: invite.inviterId, addresseeId: userId },
          { requesterId: userId, addresseeId: invite.inviterId },
        ],
      },
      data: {
        status: FriendRequestStatus.ACCEPTED,
        respondedAt: now,
      },
    });

    return {
      friendshipId: friendship.id,
      alreadyFriend: false,
      inviter: invite.inviter,
    };
  });
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const request = await getPendingRequestForAddressee(userId, requestId);

  if (request.expiresAt.getTime() <= Date.now()) {
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: {
        status: FriendRequestStatus.EXPIRED,
        respondedAt: new Date(),
      },
    });
    throw new AppError("FRIEND_REQUEST_EXPIRED", "친구 요청의 유효 기간이 지났어요.", 410);
  }

  await assertNoCommunicationBlockBetweenUsers(request.requesterId, request.addresseeId, {
    errorCode: "FRIEND_COMMUNICATION_BLOCKED",
    message: "송수신 거부 설정으로 친구 요청을 수락할 수 없어요.",
  });

  const pair = friendshipPair(request.requesterId, request.addresseeId);

  const friendship = await prisma.$transaction(async (tx) => {
    const existing = await tx.friendship.findUnique({
      where: {
        userAId_userBId: pair,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    const savedFriendship =
      existing && existing.deletedAt
        ? await tx.friendship.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              createdById: request.requesterId,
            },
          })
        : existing
          ? existing
          : await tx.friendship.create({
              data: {
                ...pair,
                createdById: request.requesterId,
              },
            });

    await tx.friendRequest.update({
      where: { id: request.id },
      data: {
        status: FriendRequestStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    return savedFriendship;
  });

  return {
    friendshipId: friendship.id,
  };
}

export async function rejectFriendRequest(userId: string, requestId: string) {
  const request = await getPendingRequestForAddressee(userId, requestId);

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: {
      status: FriendRequestStatus.REJECTED,
      respondedAt: new Date(),
    },
  });

  return { rejected: true };
}

export async function cancelFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requesterId: true,
      status: true,
    },
  });

  if (!request || request.status !== FriendRequestStatus.PENDING) {
    throw new AppError("FRIEND_REQUEST_NOT_FOUND", "처리할 친구 요청을 찾지 못했어요.", 404);
  }

  if (request.requesterId !== userId) {
    throw new AppError("FRIEND_REQUEST_FORBIDDEN", "이 친구 요청을 취소할 권한이 없어요.", 403);
  }

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: {
      status: FriendRequestStatus.CANCELED,
      respondedAt: new Date(),
    },
  });

  return { canceled: true };
}

export async function deleteFriendship(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      deletedAt: true,
    },
  });

  if (!friendship || friendship.deletedAt) {
    throw new AppError("FRIENDSHIP_NOT_FOUND", "친구 관계를 찾지 못했어요.", 404);
  }

  if (friendship.userAId !== userId && friendship.userBId !== userId) {
    throw new AppError("FRIENDSHIP_FORBIDDEN", "이 친구 관계를 삭제할 권한이 없어요.", 403);
  }

  await prisma.friendship.update({
    where: { id: friendship.id },
    data: {
      deletedAt: new Date(),
    },
  });

  return { deleted: true };
}

export async function assertActiveFriendship(userId: string, friendUserId: string, friendshipId?: string) {
  const pair = friendshipPair(userId, friendUserId);
  const friendship = await prisma.friendship.findFirst({
    where: {
      id: friendshipId,
      userAId: pair.userAId,
      userBId: pair.userBId,
      deletedAt: null,
    },
    include: {
      userA: {
        select: {
          id: true,
          nickname: true,
        },
      },
      userB: {
        select: {
          id: true,
          nickname: true,
        },
      },
    },
  });

  if (!friendship) {
    throw new AppError("FRIENDSHIP_NOT_FOUND", "선택한 친구를 찾지 못했어요.", 404);
  }

  const friend = friendship.userAId === userId ? friendship.userB : friendship.userA;

  return {
    friendshipId: friendship.id,
    friend,
  };
}

function friendshipPair(userId: string, otherUserId: string) {
  return userId < otherUserId
    ? { userAId: userId, userBId: otherUserId }
    : { userAId: otherUserId, userBId: userId };
}

async function findInviteByRawToken(rawToken: string) {
  const token = rawToken.trim();

  if (!token) {
    return null;
  }

  return prisma.friendInviteLink.findUnique({
    where: {
      tokenHash: hashPublicToken(token),
    },
    include: {
      inviter: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
  });
}

function assertInviteClaimable(
  invite: Awaited<ReturnType<typeof findInviteByRawToken>> extends infer T ? NonNullable<T> : never,
  now = new Date(),
) {
  if (invite.revokedAt) {
    throw new AppError("FRIEND_INVITE_REVOKED", "폐기된 친구 초대 링크예요.", 410);
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("FRIEND_INVITE_EXPIRED", "만료된 친구 초대 링크예요.", 410);
  }

  if (invite.claimCount >= invite.maxClaims) {
    throw new AppError("FRIEND_INVITE_ALREADY_USED", "이미 사용된 친구 초대 링크예요.", 409);
  }
}

function getInviteAvailability(invite: Awaited<ReturnType<typeof findInviteByRawToken>> extends infer T ? NonNullable<T> : never) {
  if (invite.revokedAt) {
    return { available: false, reason: "REVOKED" };
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    return { available: false, reason: "EXPIRED" };
  }

  if (invite.claimCount >= invite.maxClaims) {
    return { available: false, reason: "ALREADY_USED" };
  }

  return { available: true, reason: null };
}

function mapInvite(invite: Awaited<ReturnType<typeof findInviteByRawToken>> extends infer T ? NonNullable<T> : never) {
  return {
    id: invite.id,
    tokenPreview: invite.tokenPreview,
    expiresAt: invite.expiresAt,
    maxClaims: invite.maxClaims,
    claimCount: invite.claimCount,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    inviter: invite.inviter,
  };
}

function toFriendInviteUrl(rawToken: string) {
  return `${config.serviceUrl}/friends/invite/${rawToken}`;
}

async function getPendingRequestForAddressee(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requesterId: true,
      addresseeId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!request || request.status !== FriendRequestStatus.PENDING) {
    throw new AppError("FRIEND_REQUEST_NOT_FOUND", "처리할 친구 요청을 찾지 못했어요.", 404);
  }

  if (request.addresseeId !== userId) {
    throw new AppError("FRIEND_REQUEST_FORBIDDEN", "이 친구 요청을 처리할 권한이 없어요.", 403);
  }

  return request;
}

function normalizeOptional(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
