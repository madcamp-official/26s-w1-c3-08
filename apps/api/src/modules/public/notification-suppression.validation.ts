import { z } from "zod";

export const notificationSuppressionSchema = z.object({
  token: z.string().trim().min(1),
  channel: z.enum(["EMAIL", "SMS"]),
});

export const createNotificationSuppressionSchema = notificationSuppressionSchema;
export const deleteNotificationSuppressionSchema = notificationSuppressionSchema;

export type NotificationSuppressionInput = z.infer<typeof notificationSuppressionSchema>;
