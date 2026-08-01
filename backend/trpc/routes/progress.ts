import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import * as z from "zod";

import { db } from "../../db";
import { completedChallenges } from "../../db/schema";
import { createTRPCRouter, protectedProcedure } from "../create-context";

function throwProgressUnavailable(error: unknown): never {
  console.error("[progress] Neon database error:", error);

  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Progress is temporarily unavailable. Please try again shortly.",
  });
}

export const progressRouter = createTRPCRouter({
  getCompletedChallenges: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only fetch your own completed challenges.",
        });
      }

      try {
        return await db
          .select({
            id: completedChallenges.id,
            userId: completedChallenges.userId,
            challengeId: completedChallenges.challengeId,
            nodeId: completedChallenges.nodeId,
            challengeXp: completedChallenges.challengeXp,
            completedAt: completedChallenges.completedAt,
          })
          .from(completedChallenges)
          .where(eq(completedChallenges.userId, input.userId))
          .orderBy(desc(completedChallenges.completedAt));
      } catch (error) {
        throwProgressUnavailable(error);
      }
    }),

  addCompletedChallenge: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        challengeId: z.string().min(1),
        nodeId: z.string().min(1),
        challengeXp: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only save your own progress.",
        });
      }

      try {
        const existing = await db
          .select({ id: completedChallenges.id })
          .from(completedChallenges)
          .where(
            and(
              eq(completedChallenges.userId, input.userId),
              eq(completedChallenges.challengeId, input.challengeId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return { status: "already_completed" as const };
        }

        await db.insert(completedChallenges).values({
          userId: input.userId,
          challengeId: input.challengeId,
          nodeId: input.nodeId,
          challengeXp: input.challengeXp,
        });

        return { status: "completed" as const };
      } catch (error) {
        throwProgressUnavailable(error);
      }
    }),
});
