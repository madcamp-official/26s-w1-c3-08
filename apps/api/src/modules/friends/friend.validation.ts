import { z } from "zod";

export const createFriendRequestSchema = z.object({
  friendCode: z.string().trim().min(4).max(20),
  message: z.string().trim().max(120).optional().or(z.literal("")),
});

export type CreateFriendRequestInput = z.infer<typeof createFriendRequestSchema>;
