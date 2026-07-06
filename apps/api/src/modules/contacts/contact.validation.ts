import { z } from "zod";

export const createUserContactSchema = z.object({
  type: z.enum(["EMAIL", "PHONE"]),
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().max(80).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.type === "EMAIL" && !z.string().email().safeParse(value.value).success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "올바른 이메일 주소를 입력해 주세요.",
    });
  }
});

export const verifyUserContactSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "인증번호 6자리를 입력해 주세요."),
});

export const updateUserContactSchema = z.object({
  label: z.string().trim().max(80).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});

export type CreateUserContactInput = z.infer<typeof createUserContactSchema>;
export type VerifyUserContactInput = z.infer<typeof verifyUserContactSchema>;
export type UpdateUserContactInput = z.infer<typeof updateUserContactSchema>;
