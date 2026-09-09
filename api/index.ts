import type { IncomingMessage, ServerResponse } from "http";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

console.log("[API] Initializing server...");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Add error handling middleware FIRST
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Error Middleware]", err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Simple health check endpoint
app.get("/health", (_req, res) => {
  console.log("[API] Health check");
  res.json({ ok: true, service: "soundwave-api" });
});

// Log all requests
app.use((_req, _res, next) => {
  console.log("[API] Request:", _req.method, _req.path);
  next();
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
  console.log("[API] 404:", _req.method, _req.path);
  res.status(404).json({ error: "Not found", path: (_req as any).path });
});

// Export handler for Vercel
export default (req: IncomingMessage, res: ServerResponse) => {
  console.log("[API Handler] Received request:", req.method, (req as any).url);
  app(req as any, res as any);
};

export { app };
