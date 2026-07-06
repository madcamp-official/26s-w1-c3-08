import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  createUserContactController,
  deleteUserContactController,
  listUserContactsController,
  sendUserContactVerificationCodeController,
  updateUserContactController,
  verifyUserContactController,
} from "./contact.controller.js";

export const contactRoutes = Router();

contactRoutes.get("/me/contacts", authMiddleware, listUserContactsController);
contactRoutes.post("/me/contacts", authMiddleware, createUserContactController);
contactRoutes.post("/me/contacts/:id/send-code", authMiddleware, sendUserContactVerificationCodeController);
contactRoutes.post("/me/contacts/:id/verify", authMiddleware, verifyUserContactController);
contactRoutes.patch("/me/contacts/:id", authMiddleware, updateUserContactController);
contactRoutes.delete("/me/contacts/:id", authMiddleware, deleteUserContactController);
