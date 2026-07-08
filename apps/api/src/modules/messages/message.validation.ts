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

const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const attachmentSchema = z
  .object({
    fileName: z.string().trim().max(255).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    dataBase64: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (!value.fileName) {
      return;
    }

    const normalized = value.fileName.toLowerCase();
    const isAllowed = allowedAttachmentExtensions.some((extension) => normalized.endsWith(extension));

    if (!isAllowed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fileName"],
        message: "이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.",
      });
    }
  });

export const createMessageSchema = z
  .object({
    receiverInfo: receiverInfoSchema.optional(),
    recipients: z.array(receiverInfoSchema).min(1).max(20).optional(),
    senderContactId: z.string().uuid().optional(),
    senderDisplayName: z.string().trim().max(80).optional().or(z.literal("")),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(5000),
    emotionTag: z
      .enum(["THANKS", "CHEER", "CELEBRATION", "COMFORT", "LONGING", "LOVE", "CUSTOM"])
      .optional(),
    customEmotionTag: z.string().trim().max(120).optional(),
    scheduledAt: z.string().datetime().optional(),
    arrivalMode: z.enum(["FIXED", "RANDOM_WINDOW"]).default("FIXED").optional(),
    arrivalWindowStartAt: z.string().datetime().optional(),
    arrivalWindowEndAt: z.string().datetime().optional(),
    hintAt: z.string().datetime().optional(),
    theme: z.enum(["LAVENDER", "MOSS", "SUNSET", "MIDNIGHT", "PAPER"]).default("LAVENDER").optional(),
    isReplyEnabled: z.boolean().default(true).optional(),
    attachments: z.array(attachmentSchema).max(3).default([]).optional(),
    isSenderHidden: z.boolean().default(false),
    isDateHidden: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const receivers = value.recipients?.length ? value.recipients : value.receiverInfo ? [value.receiverInfo] : [];

    if (receivers.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipients"],
        message: "수신자를 한 명 이상 선택해 주세요.",
      });
    }

    if (value.arrivalMode === "RANDOM_WINDOW") {
      if (!value.arrivalWindowStartAt || !value.arrivalWindowEndAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["arrivalWindowStartAt"],
          message: "랜덤 도착은 시작 시간과 종료 시간이 필요합니다.",
        });
      } else {
        const start = new Date(value.arrivalWindowStartAt);
        const end = new Date(value.arrivalWindowEndAt);

        if (start.getTime() <= Date.now()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["arrivalWindowStartAt"],
            message: "랜덤 도착 시작 시간은 현재보다 미래여야 합니다.",
          });
        }

        if (end.getTime() <= start.getTime()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["arrivalWindowEndAt"],
            message: "랜덤 도착 종료 시간은 시작 시간보다 뒤여야 합니다.",
          });
        }
      }
    } else if (!value.scheduledAt || new Date(value.scheduledAt).getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "예약 시간은 현재보다 미래여야 합니다.",
      });
    }

    const scheduleReference =
      value.arrivalMode === "RANDOM_WINDOW" && value.arrivalWindowStartAt ? value.arrivalWindowStartAt : value.scheduledAt;

    if (value.hintAt && scheduleReference) {
      const hintAt = new Date(value.hintAt);
      const scheduledAt = new Date(scheduleReference);

      if (hintAt.getTime() <= Date.now() || hintAt.getTime() >= scheduledAt.getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hintAt"],
          message: "힌트 알림 시간은 현재 이후이면서 도착 시간보다 앞서야 합니다.",
        });
      }
    }

    for (const [index, receiverInfo] of receivers.entries()) {
      validateReceiverInfo(receiverInfo, context, value.recipients?.length ? ["recipients", index] : ["receiverInfo"]);
    }
  });

function validateReceiverInfo(
  receiverInfo: z.infer<typeof receiverInfoSchema>,
  context: z.RefinementCtx,
  basePath: Array<string | number>,
) {
    if (receiverInfo.type === "FRIEND") {
      if (!receiverInfo.friendshipId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...basePath, "friendshipId"],
          message: "친구에게 보내려면 친구 관계 정보가 필요합니다.",
        });
      }

      if (!receiverInfo.userId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...basePath, "userId"],
          message: "친구에게 보내려면 수신자 정보가 필요합니다.",
        });
      }

      return;
    }

    if (receiverInfo.type !== "OTHER") {
      return;
    }

    if (!receiverInfo.name || receiverInfo.name.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...basePath, "name"],
        message: "타인에게 보내려면 수신자 이름이 필요합니다.",
      });
    }

    const hasEmail = Boolean(receiverInfo.email && receiverInfo.email.trim().length > 0);
    const hasPhoneInput = Boolean(receiverInfo.phone && receiverInfo.phone.trim().length > 0);
    const normalizedPhone = hasPhoneInput ? normalizePhoneContact(receiverInfo.phone ?? "") : null;
    const hasPhone = Boolean(normalizedPhone);
    const preferredChannel = receiverInfo.preferredChannel ?? "AUTO";

    if (hasPhoneInput && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...basePath, "phone"],
        message: "전화번호는 국내 번호 10~11자리로 입력해 주세요.",
      });
    }

    if (preferredChannel === "EMAIL" && !hasEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...basePath, "email"],
        message: "이메일 알림을 보내려면 수신자 이메일이 필요합니다.",
      });
    }

    if (preferredChannel === "SMS" && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...basePath, "phone"],
        message: "문자 알림을 보내려면 수신자 전화번호가 필요합니다.",
      });
    }

    if (preferredChannel === "AUTO" && !hasEmail && !hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...basePath, "email"],
        message: "타인에게 보내려면 이메일이나 전화번호 중 하나가 필요합니다.",
      });
    }
}

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const createMessageReplySchema = z.object({
  content: z.string().trim().min(1).max(2000),
  senderDisplayName: z.string().trim().max(80).optional().or(z.literal("")),
  isAnonymous: z.boolean().default(true).optional(),
});

export type CreateMessageReplyInput = z.infer<typeof createMessageReplySchema>;
