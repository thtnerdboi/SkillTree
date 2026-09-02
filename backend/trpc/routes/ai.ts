import { TRPCError } from "@trpc/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { publicProcedure, createTRPCRouter } from "../create-context";

const NODE_IDS = [
  "calm",
  "vitality",
  "spark",
  "focus",
  "reflection",
  "energy",
  "build",
  "learning",
  "strength",
  "coding",
  "recovery",
  "discipline",
  "endurance",
  "making",
  "memory",
  "creativity",
  "mobility",
  "output",
  "nutrition",
  "insight",
  "sleep",
  "career",
  "expression",
  "flow",
  "peak",
  "mastery",
  "legacy",
] as const;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_REQUEST_TIMEOUT_MS = 12_000;
const MAX_GEMINI_INPUT_LENGTH = 500;

const AI_GENERATION_RATE_LIMIT = 20;
const AI_GENERATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const aiGenerationRateLimits = new Map<string, RateLimitEntry>();

const challengeSchema = z.object({
  title: z.string().min(1).max(60),
  detail: z.string().min(1).max(120),
  xp: z.number().int().min(1).max(500),
});

const aiTreeSchema = z.object(
  Object.fromEntries(
    NODE_IDS.map((nodeId) => [nodeId, z.array(challengeSchema).length(3)])
  ) as Record<(typeof NODE_IDS)[number], z.ZodArray<typeof challengeSchema>>
);

const extractJsonObject = (text: string) => {
  const withoutCodeFences = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = withoutCodeFences.indexOf("{");
  const lastBrace = withoutCodeFences.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return withoutCodeFences;
  }

  return withoutCodeFences.slice(firstBrace, lastBrace + 1);
};

const getRateLimitKey = (req: Request, userId: string | null) => {
  if (userId) {
    return `user:${userId}`;
  }

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ipAddress = forwardedFor || realIp || "unknown";

  return `anonymous:${ipAddress}`;
};

const removeExpiredRateLimitEntries = (now: number) => {
  for (const [key, entry] of aiGenerationRateLimits.entries()) {
    if (now - entry.windowStart >= AI_GENERATION_RATE_LIMIT_WINDOW_MS) {
      aiGenerationRateLimits.delete(key);
    }
  }
};

const enforceAiGenerationRateLimit = (rateLimitKey: string) => {
  const now = Date.now();
  removeExpiredRateLimitEntries(now);

  const existing = aiGenerationRateLimits.get(rateLimitKey);
  const entry =
    existing && now - existing.windowStart < AI_GENERATION_RATE_LIMIT_WINDOW_MS
      ? existing
      : { count: 0, windowStart: now };

  if (entry.count >= AI_GENERATION_RATE_LIMIT) {
    const retryAfterMs = Math.max(
      entry.windowStart + AI_GENERATION_RATE_LIMIT_WINDOW_MS - now,
      0
    );
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));

    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You've reached the Pro AI generation limit of ${AI_GENERATION_RATE_LIMIT} per hour. Please try again in about ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`,
    });
  }

  entry.count += 1;
  aiGenerationRateLimits.set(rateLimitKey, entry);
};

const nodeChallengeSingleSchema = z.object({
  title: z.string().min(1).max(60),
  detail: z.string().min(1).max(120),
});

function sanitizeGeminiInput<T>(value: T): T {
  if (typeof value === "string") {
    return value.slice(0, MAX_GEMINI_INPUT_LENGTH) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGeminiInput(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeGeminiInput(item)])
    ) as T;
  }

  return value;
}

export const aiRouter = createTRPCRouter({
  regenerateNode: publicProcedure
    .input(
      z.object({
        nodeId: z.string(),
        nodeTitle: z.string().max(60),
        nodeDescription: z.string().max(200),
        goal: z.string().max(200),
        xpValues: z.tuple([
          z.number().int().min(1).max(500),
          z.number().int().min(1).max(500),
          z.number().int().min(1).max(500),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      enforceAiGenerationRateLimit(getRateLimitKey(ctx.req, ctx.userId));
      const safeInput = sanitizeGeminiInput(input);

      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GEMINI_API_KEY is missing from backend environment variables.",
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: "application/json" },
      }, { timeout: GEMINI_REQUEST_TIMEOUT_MS });

      const prompt = `
        You are an expert gamified habit tracker and RPG skill tree designer.
        Generate exactly 3 personalised micro-challenges for the skill node "${safeInput.nodeTitle}".
        Node description: ${safeInput.nodeDescription}
        User's personal goal: ${safeInput.goal}

        Rules:
        - Titles: under 4 words, written like RPG quest names
        - Details: under 12 words, specific and directly tied to the user's goal
        - Each challenge must feel meaningfully different from the others

        Respond ONLY with a valid JSON object, no markdown:
        { "challenges": [{ "title": "...", "detail": "..." }, { "title": "...", "detail": "..." }, { "title": "...", "detail": "..." }] }
      `;

      try {
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const jsonText = extractJsonObject(rawText);
        const parsed = JSON.parse(jsonText);

        const challenges = z.array(nodeChallengeSingleSchema).length(3).parse(parsed.challenges);

        return challenges.map((c, i) => ({
          title: c.title,
          detail: c.detail,
          xp: safeInput.xpValues[i],
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Gemini regenerateNode error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate personalised challenges.",
        });
      }
    }),

  generateTree: publicProcedure
    .input(
      z.object({
        mind: z.string().optional(),
        body: z.string().optional(),
        craft: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      enforceAiGenerationRateLimit(getRateLimitKey(ctx.req, ctx.userId));
      const safeInput = sanitizeGeminiInput(input);

      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GEMINI_API_KEY is missing from backend environment variables.",
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
        },
      }, { timeout: GEMINI_REQUEST_TIMEOUT_MS });

      const prompt = `
        You are an expert gamified habit tracker and RPG skill tree designer.
        The user has provided the following main goals:
        - Mind: ${safeInput.mind || "General mental clarity"}
        - Body: ${safeInput.body || "General physical health"}
        - Craft: ${safeInput.craft || "General skill improvement"}

        Create 3 actionable micro-challenges for each of these exact node IDs:
        calm, vitality, spark, focus, reflection, energy, build, learning, strength,
        coding, recovery, discipline, endurance, making, memory, creativity, mobility,
        output, nutrition, insight, sleep, career, expression, flow, peak, mastery, legacy

        Keep titles under 3 words. Keep details under 10 words. Make them sound like RPG quests.

        Respond ONLY with a valid JSON object with no markdown, where keys are node IDs and values are arrays of exactly 3 challenges:
        {
          "calm": [{ "title": "...", "detail": "...", "xp": 30 }, ...],
          "vitality": [...],
          ...all 27 nodes...
        }
      `;

      try {
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const jsonText = extractJsonObject(rawText);
        const parsed = JSON.parse(jsonText);
        return aiTreeSchema.parse(parsed);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Gemini AI Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate challenges from AI.",
        });
      }
    }),
});
