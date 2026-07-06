import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import {
  createUserContact,
  deleteUserContact,
  listUserContacts,
  sendUserContactVerificationCode,
  updateUserContact,
  verifyUserContact,
} from "./contact.service.js";
import {
  createUserContactSchema,
  updateUserContactSchema,
  verifyUserContactSchema,
} from "./contact.validation.js";

export const listUserContactsController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ contacts: await listUserContacts(request.user.id) });
});

export const createUserContactController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const input = createUserContactSchema.parse(request.body);
  response.status(201).json(await createUserContact(request.user.id, input));
});

export const sendUserContactVerificationCodeController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const contactId = requiredContactId(request.params.id);
  response.json(await sendUserContactVerificationCode(request.user.id, contactId));
});

export const verifyUserContactController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const contactId = requiredContactId(request.params.id);
  const input = verifyUserContactSchema.parse(request.body);
  response.json(await verifyUserContact(request.user.id, contactId, input));
});

export const updateUserContactController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const contactId = requiredContactId(request.params.id);
  const input = updateUserContactSchema.parse(request.body);
  response.json(await updateUserContact(request.user.id, contactId, input));
});

export const deleteUserContactController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const contactId = requiredContactId(request.params.id);
  response.json(await deleteUserContact(request.user.id, contactId));
});

function requiredContactId(value?: string) {
  if (!value) {
    throw new AppError("CONTACT_ID_REQUIRED", "연락처 정보를 찾을 수 없어요.", 400);
  }

  return value;
}
