import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { scrapeYouTubeSearch } from "./youtube-scraper";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  youtube: router({
    search: publicProcedure
      .input(z.object({ query: z.string().trim().min(1).max(120) }))
      .mutation(async ({ input }) => ({
        query: input.query,
        results: await scrapeYouTubeSearch(input.query),
      })),
  }),
});

export type AppRouter = typeof appRouter;
