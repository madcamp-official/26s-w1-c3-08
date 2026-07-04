import { z } from "zod";
import { normalizePhoneContact } from "../../lib/contact-normalization.js";

const receiverInfoSchema = z.object({
  type: z.enum(["SELF", "FRIEND", "OTHER"]),
  friendshipId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  preferredChannel: z.enum(["AUTO", "SMS", "EMAIL"]).default("AUTO").optional(),
});

export const createMessageSchema = z
  .object({
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
  })
  .superRefine((value, context) => {
    if (value.receiverInfo.type === "FRIEND") {
      if (!value.receiverInfo.friendshipId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receiverInfo", "friendshipId"],
          message: "친구에게 보내려면 친구 관계 정보가 필요합니다.",
        });
      }

      if (!value.receiverInfo.userId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receiverInfo", "userId"],
          message: "친구에게 보내려면 수신자 정보가 필요합니다.",
        });
      }

      return;
    }

    if (value.receiverInfo.type !== "OTHER") {
      return;
    }

    if (!value.receiverInfo.name || value.receiverInfo.name.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverInfo", "name"],
        message: "타인에게 보내려면 수신자 이름이 필요합니다.",
      });
    }

    const hasEmail = Boolean(value.receiverInfo.email && value.receiverInfo.email.trim().length > 0);
    const hasPhoneInput = Boolean(value.receiverInfo.phone && value.receiverInfo.phone.trim().length > 0);
    const normalizedPhone = hasPhoneInput ? normalizePhoneContact(value.receiverInfo.phone ?? "") : null;
    const hasPhone = Boolean(normalizedPhone);
    const preferredChannel = value.receiverInfo.preferredChannel ?? "AUTO";

    if (hasPhoneInput && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverInfo", "phone"],
        message: "전화번호는 국내 번호 10~11자리로 입력해 주세요.",
      });
    }

    if (preferredChannel === "EMAIL" && !hasEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverInfo", "email"],
        message: "이메일 알림을 보내려면 수신자 이메일이 필요합니다.",
      });
    }

    if (preferredChannel === "SMS" && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverInfo", "phone"],
        message: "문자 알림을 보내려면 수신자 전화번호가 필요합니다.",
      });
    }

    if (preferredChannel === "AUTO" && !hasEmail && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverInfo", "email"],
        message: "타인에게 보내려면 이메일이나 전화번호 중 하나가 필요합니다.",
      });
    }
  });

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
