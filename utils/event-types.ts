export const ANALYTICS_EVENTS = {
  SIGN_IN: "sign_in",
  SIGN_OUT: "sign_out",

  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_AI_GENERATED: "onboarding_ai_generated",
  ONBOARDING_AI_FAILED: "onboarding_ai_failed",

  CHALLENGE_COMPLETED: "challenge_completed",
  CHALLENGE_UNCOMPLETED: "challenge_uncompleted",
  NODE_COMPLETED: "node_completed",
  LEVEL_COMPLETED: "level_completed",

  PRESTIGE_TRIGGERED: "prestige_triggered",
  PRESTIGE_DISMISSED: "prestige_dismissed",

  NODE_PANEL_OPENED: "node_panel_opened",
  NODE_GOALS_REGENERATED: "node_goals_regenerated",

  FRIEND_REQUEST_SENT: "friend_request_sent",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",

  AD_REWARD_CLAIMED: "ad_reward_claimed",

  APP_ERROR: "app_error",
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
