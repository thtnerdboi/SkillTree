/**
 * Fitness challenge verification — manual self-report logging.
 *
 * Expo cannot read HealthKit / Google Fit / wearable data without a native
 * module and (on iOS) an Apple Developer account + real device. Until that's
 * available, users self-report today's steps/active minutes/distance from
 * their phone or watch's own health app, and a challenge is verified once
 * the reported value meets the node's threshold.
 */

import type { Challenge, FitnessMetric } from "@/mocks/mvp-data";

export type FitnessLogEntry = {
  steps: number;
  activeMinutes: number;
  distance: number;
  loggedAt: string;
};

const METRIC_LABELS: Record<FitnessMetric, string> = {
  steps: "Steps",
  activeMinutes: "Active Minutes",
  distance: "Distance",
};

export function getFitnessMetricLabel(metric: FitnessMetric): string {
  return METRIC_LABELS[metric] ?? "Activity";
}

export function formatFitnessValue(metric: FitnessMetric, value: number): string {
  if (metric === "steps") return `${value.toLocaleString()} steps`;
  if (metric === "activeMinutes") return `${value} min`;
  if (metric === "distance") return `${value} km`;
  return `${value}`;
}

/**
 * A fitness challenge is verified once today's logged entry meets or exceeds
 * the challenge's threshold for its metric. Returns false if nothing has
 * been logged yet today, or the challenge isn't a fitness type.
 */
export function isFitnessChallengeVerified(
  challenge: Challenge,
  todayLog: FitnessLogEntry | undefined
): boolean {
  if (challenge.type !== "fitness") return false;
  if (!challenge.fitnessMetric || challenge.fitnessThreshold === undefined) return false;
  if (!todayLog) return false;

  const value = todayLog[challenge.fitnessMetric];
  return value >= challenge.fitnessThreshold;
}
