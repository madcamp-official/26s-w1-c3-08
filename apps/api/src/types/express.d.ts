import type { User } from "@maeum-arrival/database";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "kakaoId" | "nickname" | "email" | "onboardingNote">;
    }
  }
}

export {};
