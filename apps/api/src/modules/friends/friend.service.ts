import { FriendRequestStatus } from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateFriendRequestInput } from "./friend.validation.js";

const FRIEND_REQUEST_TTL_DAYS = 14;

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
