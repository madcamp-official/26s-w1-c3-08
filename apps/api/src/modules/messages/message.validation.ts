import { z } from "zod";

const receiverInfoSchema = z.object({
  type: z.enum(["SELF", "OTHER"]),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
});

export const createMessageSchema = z.object({
  receiverInfo: receiverInfoSchema,
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(5000),
  emotionTag: z
    .enum(["THANKS", "CHEER", "CELEBRATION", "COMFORT", "LONGING", "LOVE", "CUSTOM"])
    .optional(),
  customEmotionTag: z.string().trim().max(40).optional(),
  scheduledAt: z
    .string()
    .datetime()
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message: "예약 시간은 현재보다 미래여야 합니다.",
    }),
  isSenderHidden: z.boolean().default(false),
  isDateHidden: z.boolean().default(false),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
