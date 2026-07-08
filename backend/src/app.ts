import cors from "cors";
import express from "express";
import { authRouter } from "./features/auth/auth.routes";
import { connectionsRouter } from "./features/connections/connections.routes";
import { queryRouter } from "./features/query/query.routes";

// Assembles the Express app. Kept separate from index.ts so the app can be
// imported (e.g. for tests) without binding a port.
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
  app.use(express.json());

  app.use("/auth", authRouter);
  app.use("/connections", connectionsRouter);
  app.use("/query", queryRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
