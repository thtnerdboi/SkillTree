import { publicProcedure, router } from "../create-context";
import { z } from "zod";
import { publicProcedure, router } from "../store";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const aiRouter = router({
  generateTree: publicProcedure
    .input(
      z.object({
        mind: z.string().optional(),
        body: z.string().optional(),
        craft: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Initialize Gemini using your environment variable
      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing from backend environment variables.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are an expert gamified habit tracker and RPG skill tree designer.
        The user has provided the following main goals for three different domains of their life:
        - Mind (Focus/Mental health): ${input.mind || "General mental clarity"}
        - Body (Health/Fitness): ${input.body || "General physical health"}
        - Craft (Career/Hobby): ${input.craft || "General skill improvement"}

        Create 3 actionable, highly specific micro-challenges for each domain to act as the "Level 1" foundation. 
        Keep titles under 3 words. Keep details under 10 words. Make them sound like RPG quests.

        Respond ONLY with a valid JSON object in the exact following structure, with no markdown formatting or extra text:
        {
          "calm": [
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 }
          ],
          "vitality": [
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 }
          ],
          "spark": [
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 },
            { "title": "...", "detail": "...", "xp": 30 }
          ]
        }
      `;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Clean up markdown code blocks if the AI includes them just to be safe
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanedText);
      } catch (error) {
        console.error("Gemini AI Error:", error);
        throw new Error("Failed to generate challenges from AI.");
      }
    }),
});