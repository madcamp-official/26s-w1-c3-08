import type { Request, Response } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  deleteFriendship,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
} from "./friend.service.js";

export const listFriendsController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ friends: await listFriends(request.user.id) });
});

export const listFriendRequestsController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ requests: await listFriendRequests(request.user.id) });
});

export const createFriendRequestController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.status(201).json({ request: await createFriendRequest(request.user.id, request.body) });
});

export const acceptFriendRequestController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await acceptFriendRequest(request.user.id, requireId(request.params.id)));
});

export const rejectFriendRequestController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await rejectFriendRequest(request.user.id, requireId(request.params.id)));
});

export const cancelFriendRequestController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await cancelFriendRequest(request.user.id, requireId(request.params.id)));
});

export const deleteFriendshipController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await deleteFriendship(request.user.id, requireId(request.params.friendshipId)));
});

function requireId(value?: string) {
  if (!value) {
    throw new AppError("ID_REQUIRED", "요청 정보를 찾지 못했어요.", 400);
  }

  return value;
}
