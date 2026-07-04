import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { friendRoutes } from "./modules/friends/friend.routes.js";
import { messageRoutes } from "./modules/messages/message.routes.js";
import { publicMessageRoutes } from "./modules/public/public-message.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api", authRoutes);
  app.use("/api", friendRoutes);
  app.use("/api", messageRoutes);
  app.use("/api", publicMessageRoutes);

  app.use(errorMiddleware);

  return app;
}
