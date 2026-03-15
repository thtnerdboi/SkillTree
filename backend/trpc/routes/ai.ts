import { publicProcedure, createTRPCRouter } from "../create-context";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        const text = result.response.text();
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
      } catch (error) {
        console.error("Gemini AI Error:", error);
        throw new Error("Failed to generate challenges from AI.");
      }
    }),
});