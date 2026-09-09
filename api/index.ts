import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "soundwave-api" });
});

// tRPC endpoint - Vercel passes /trpc when /api/trpc is requested
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Fallback for /api/trpc path (in case Vercel routing includes /api)
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default app;
