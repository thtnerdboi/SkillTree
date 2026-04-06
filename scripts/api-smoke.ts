import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../backend/trpc/app-router";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const trpcUrl = `${baseUrl.replace(/\/+$/, "")}/api/trpc`;
const runGeminiTest = process.env.RUN_GEMINI_TEST === "1";
const userId = process.env.TEST_USER_ID ?? `smoke-user-${Date.now()}`;

let activeAuthUserId: string | null = userId;

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      headers() {
        return activeAuthUserId
          ? { authorization: `Bearer ${activeAuthUserId}` }
          : {};
      },
    }),
  ],
});

type CheckResult = { label: string; ok: boolean; detail: string };

const checks: CheckResult[] = [];

const addCheck = (label: string, ok: boolean, detail: string) => {
  checks.push({ label, ok, detail });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${label} - ${detail}`);
};

const tryCall = async <T>(label: string, run: () => Promise<T>) => {
  try {
    const result = await run();
    addCheck(label, true, "passed");
    return result;
  } catch (error) {
    const message =
      error instanceof TRPCClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    addCheck(label, false, message);
    return null;
  }
};

const expectFailure = async (label: string, run: () => Promise<unknown>, expectedMessage: RegExp) => {
  try {
    await run();
    addCheck(label, false, "request unexpectedly succeeded");
  } catch (error) {
    const message =
      error instanceof TRPCClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    const matches = expectedMessage.test(message);
    addCheck(label, matches, matches ? "rejected as expected" : message);
  }
};

const main = async () => {
  console.log(`\n🔎 SkillTree API smoke test`);
  console.log(`   URL: ${trpcUrl}`);
  console.log(`   userId: ${userId}`);
  console.log(`   RUN_GEMINI_TEST=${runGeminiTest ? "1" : "0"}\n`);

  await tryCall("social.healthCheck", () => client.social.healthCheck.query());

  await tryCall("social.upsertUser", () =>
    client.social.upsertUser.mutate({
      userId,
      name: "Smoke Tester",
      inviteCode: `SMOKE${Math.floor(Math.random() * 100000)}`,
      weeklyCompletion: 10,
    })
  );

  await tryCall("social.createSubscriptionIntent", () =>
    client.social.createSubscriptionIntent.mutate({ userId })
  );

  if (runGeminiTest) {
    await tryCall("ai.generateTree", async () => {
      const generated = await client.ai.generateTree.mutate({
        mind: "Focus better at work",
        body: "Get in shape",
        craft: "Improve coding consistency",
      });
      const calmCount = Array.isArray((generated as any).calm) ? (generated as any).calm.length : 0;
      if (calmCount !== 3) {
        throw new Error("ai.generateTree returned invalid challenge count for calm node.");
      }
      return generated;
    });
  } else {
    console.log("⚠️ Skipped ai.generateTree (set RUN_GEMINI_TEST=1 to include it).");
  }

  activeAuthUserId = null;
  await expectFailure(
    "social.getUser unauthorized check",
    () => client.social.getUser.query({ userId }),
    /UNAUTHORIZED/i
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n🧾 Summary: ${checks.length - failed.length}/${checks.length} checks passed.`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("❌ Smoke test crashed:", error);
  process.exit(1);
});
