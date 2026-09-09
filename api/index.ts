import type { IncomingMessage, ServerResponse } from "http";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Add error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Error]", err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "soundwave-api" });
});

// tRPC endpoint - handle multiple path variations
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Export as both default and handler for Vercel
export default (req: IncomingMessage, res: ServerResponse) => {
  return app(req as any, res as any);
};

export { app };
