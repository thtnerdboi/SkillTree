import { publicProcedure, createTRPCRouter } from "../create-context";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

export const aiRouter = createTRPCRouter({
  generateTree: publicProcedure
    .input(
      z.object({
        mind: z.string().optional(),
        body: z.string().optional(),
        craft: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing from backend environment variables.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const prompt = `
        You are an expert gamified habit tracker and RPG skill tree designer.
        The user has provided the following main goals:
        - Mind: ${input.mind || "General mental clarity"}
        - Body: ${input.body || "General physical health"}
        - Craft: ${input.craft || "General skill improvement"}

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
        console.error("Gemini AI Error:", error);
        throw new Error("Failed to generate challenges from AI.");
      }
    }),
});
