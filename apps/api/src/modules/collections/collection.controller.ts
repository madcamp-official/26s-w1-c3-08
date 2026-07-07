import type { Request, Response } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  cancelMessageCollection,
  createMessageCollection,
  createPublicMessageCollectionSubmission,
  getMessageCollection,
  getPublicMessageCollection,
  listMessageCollections,
} from "./collection.service.js";

export const createMessageCollectionController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.status(201).json({ collection: await createMessageCollection(request.user.id, request.body) });
});

export const listMessageCollectionsController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ collections: await listMessageCollections(request.user.id) });
});

export const getMessageCollectionController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const collectionId = requireParam(request.params.id, "COLLECTION_ID_REQUIRED");
  response.json({ collection: await getMessageCollection(request.user.id, collectionId) });
});

export const cancelMessageCollectionController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const collectionId = requireParam(request.params.id, "COLLECTION_ID_REQUIRED");
  response.json(await cancelMessageCollection(request.user.id, collectionId));
});

export const getPublicMessageCollectionController = asyncHandler(async (request: Request, response: Response) => {
  const token = requireParam(request.params.token, "COLLECTION_TOKEN_REQUIRED");
  response.json({ collection: await getPublicMessageCollection(token) });
});

export const createPublicMessageCollectionSubmissionController = asyncHandler(async (request: Request, response: Response) => {
  const token = requireParam(request.params.token, "COLLECTION_TOKEN_REQUIRED");
  response.status(201).json(
    await createPublicMessageCollectionSubmission(token, request.body, request.ip ?? "unknown"),
  );
});

function requireParam(value: string | undefined, code: string) {
  if (!value) {
    throw new AppError(code, "요청 정보를 찾을 수 없어요.", 400);
  }

  return value;
}
