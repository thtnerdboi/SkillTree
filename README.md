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
- RevenueCat (V1 mobile subscriptions)
- Stripe server SDK (backend routes only)
- Google Mobile Ads (Monetization)
- Google Gemini API (Dynamic Challenge Generation)
- AsyncStorage (Local Data Persistence)

## RevenueCat configuration

RevenueCat is the V1 mobile subscription system for SkillTree Pro. Mobile Pro purchases use RevenueCat with App Store and Google Play billing; Stripe is not used in the mobile Pro upgrade flow.

Production builds must receive RevenueCat configuration from EAS environment variables, not from hardcoded values in source code, `eas.json`, or committed `.env` files. These values are `EXPO_PUBLIC_*` Expo variables, so they are bundled into the native app and should be treated as publishable client configuration. Use EAS environment variable visibility such as `sensitive` to avoid casual exposure in dashboards and logs, but do not rely on these values as server-only secrets.

Required variables:

- `EXPO_PUBLIC_REVENUECAT_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID`

Set the production values in EAS with placeholder-safe commands like:

```bash
eas env:create --environment production --visibility sensitive --name EXPO_PUBLIC_REVENUECAT_API_KEY --value "REPLACE_WITH_REVENUECAT_PUBLIC_API_KEY"
eas env:create --environment production --visibility sensitive --name EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID --value "pro"
eas env:create --environment production --visibility sensitive --name EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID --value "com.example.skilltree.pro.monthly"
eas env:create --environment production --visibility sensitive --name EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID --value "com.example.skilltree.pro.yearly"
```

Use the real RevenueCat public app API key, entitlement identifier, and App Store / Google Play product identifiers from the RevenueCat dashboard when running the commands. Do not commit real production values to this repository.

Production EAS builds should use the EAS `production` environment so these variables are available during the native build:

```json
{
  "build": {
    "production": {
      "environment": "production"
    }
  }
}
```

Build production releases with:

```bash
eas build --profile production
```

Development builds show a warning if any value is missing. Production native builds fail loudly on startup when required RevenueCat config is absent.

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

## ☁️ Render deployment checklist

This backend can run on Render, but these env vars must be configured:

- `DATABASE_URL` (required)
- `STRIPE_SECRET_KEY` (required for Stripe routes)
- `STRIPE_MONTHLY_PRICE_ID` (required for subscription intent)
- `STRIPE_WEBHOOK_SECRET` (required for webhook signature verification)
- `GEMINI_API_KEY` (required for `ai.generateTree`)

Recommended Render start command:

```bash
npm ci && npm run backend
```

## ☕ Buy me a Coffee
I am solo vibecoding this so it will take time, if you want to support me you can buy me a coffee with the link below
https://buymeacoffee.com/thtnerdboi

---
*For support or inquiries, please refer to our Terms of Service and Privacy Policy.*
