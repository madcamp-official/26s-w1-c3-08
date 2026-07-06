import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  acceptFriendRequestController,
  cancelFriendRequestController,
  createFriendRequestController,
  deleteFriendshipController,
  listFriendRequestsController,
  listFriendsController,
  rejectFriendRequestController,
  searchFriendCandidatesController,
} from "./friend.controller.js";
import { createFriendRequestSchema } from "./friend.validation.js";

export const friendRoutes = Router();

friendRoutes.get("/friends", authMiddleware, listFriendsController);
friendRoutes.get("/friends/requests", authMiddleware, listFriendRequestsController);
friendRoutes.get("/friends/search", authMiddleware, searchFriendCandidatesController);
friendRoutes.post("/friends/requests", authMiddleware, validateBody(createFriendRequestSchema), createFriendRequestController);
friendRoutes.patch("/friends/requests/:id/accept", authMiddleware, acceptFriendRequestController);
friendRoutes.patch("/friends/requests/:id/reject", authMiddleware, rejectFriendRequestController);
friendRoutes.patch("/friends/requests/:id/cancel", authMiddleware, cancelFriendRequestController);
friendRoutes.delete("/friends/:friendshipId", authMiddleware, deleteFriendshipController);
