import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error.js";

export function adminMiddleware(request: Request, _response: Response, next: NextFunction) {
  if (!request.user) {
    next(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));
    return;
  }

  if (!request.user.isAdmin) {
    next(new AppError("ADMIN_FORBIDDEN", "관리자 권한이 필요합니다.", 403));
    return;
  }

  next();
}
