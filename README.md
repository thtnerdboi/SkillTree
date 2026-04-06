# SkillTree 🌳

SkillTree is a gamified habit tracker and personal development app. It turns your daily routines into an RPG, allowing you to build your "Skill Tree" by completing real-world challenges across three core pillars: Mind, Body, and Craft.

## 🎯 Vision

SkillTree explores how AI can enhance structured self-improvement
by generating dynamic goals within a gamified progression system.

## 🚀 Features
- **Interactive Skill Tree:** Unlock new nodes as you build consistency.
- **Local Privacy:** All your core progression, XP, and streaks are saved locally on your device for maximum privacy.
- **Prestige System:** Reach the top, reset your tree, and earn permanent Prestige ranks.

## 💎 SkillTree Pro ($5.99/month)
Users can upgrade to the Pro tier to supercharge their growth:
- **1.5x XP Multiplier:** Level up faster.
- **Ad-Free Experience:** Complete focus with zero interruptions.
- **AI-Powered Goals:** Custom, personalized challenges generated specifically for your lifestyle using AI.

## 🛠️ Tech Stack
- React Native & Expo
- Stripe React Native SDK (Payments)
- Google Mobile Ads (Monetization)
- Google Gemini API (Dynamic Challenge Generation)
- AsyncStorage (Local Data Persistence)

## 🧪 API Smoke Testing (No emulator required)

You can validate the backend tRPC + Gemini/Stripe flows directly from your laptop:

```bash
# 1) Run backend in one terminal
npm run backend

# 2) In another terminal, run smoke tests
npm run test:apis
```

Optional flags:

- `API_BASE_URL=http://localhost:3000` (defaults to localhost)
- `RUN_GEMINI_TEST=1` to include the Gemini generation call
- `TEST_USER_ID=my-user-id` to reuse one user for Stripe tests

## ☕ Buy me a Coffee
I am solo vibecoding this so it will take time, if you want to support me you can buy me a coffee with the link below
https://buymeacoffee.com/thtnerdboi

---
*For support or inquiries, please refer to our Terms of Service and Privacy Policy.*
