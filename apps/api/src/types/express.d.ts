import type { User } from "@maeari/database";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "kakaoId" | "nickname" | "email" | "friendCode" | "onboardingNote">;
    }
  }
}

export {};
