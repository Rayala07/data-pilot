import cors from "cors";
import express from "express";
import { corsOptions } from "./cors";
import { authRouter } from "./features/auth/auth.routes";
import { connectionsRouter } from "./features/connections/connections.routes";
import { queryRouter } from "./features/query/query.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  // One hop of proxy (Render-style load balancer). Without this, req.ip is the
  // LB for every request, and the demo endpoint's per-IP rate limit would
  // throttle all visitors as if they were one client.
  app.set("trust proxy", 1);

  app.use(cors(corsOptions()));
  app.use(express.json());

  app.use("/auth", authRouter);
  app.use("/connections", connectionsRouter);
  app.use("/query", queryRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
