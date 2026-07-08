import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import {
  createCommunicationBlock,
  deleteCommunicationBlock,
  listCommunicationBlocks,
} from "./communication-block.service.js";
import {
  communicationBlockDirectionSchema,
  createCommunicationBlockSchema,
} from "./communication-block.validation.js";

export const listCommunicationBlocksController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const direction =
    typeof request.query.direction === "string"
      ? communicationBlockDirectionSchema.parse(request.query.direction)
      : undefined;

  response.json(await listCommunicationBlocks(request.user.id, direction));
});

export const createCommunicationBlockController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const input = createCommunicationBlockSchema.parse(request.body);
  const result = await createCommunicationBlock(request.user.id, input);
  response.status(result.created ? 201 : 200).json(result);
});

export const deleteCommunicationBlockController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const blockId = request.params.id;

  if (!blockId) {
    throw new AppError("COMMUNICATION_BLOCK_ID_REQUIRED", "송수신 거부 설정 정보를 찾지 못했어요.", 400);
  }

  response.json(await deleteCommunicationBlock(request.user.id, blockId));
});
