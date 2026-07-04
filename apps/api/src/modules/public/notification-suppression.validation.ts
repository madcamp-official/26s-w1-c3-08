import { z } from "zod";

export const createNotificationSuppressionSchema = z.object({
  token: z.string().trim().min(1),
  channel: z.enum(["EMAIL", "SMS"]),
});

export type CreateNotificationSuppressionInput = z.infer<typeof createNotificationSuppressionSchema>;
