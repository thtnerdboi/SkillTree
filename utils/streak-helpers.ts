/**
 * Streak tracking utilities — date helpers, streak computation, and milestone rewards.
 */

/** Returns YYYY-MM-DD for a Date or timestamp in local time. */
export function toDateKey(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date key in local time. */
export function todayKey(): string {
  return toDateKey(Date.now());
}

/** Difference in calendar days between two date keys (b - a). Returns 0 if same day. */
export function dayDiff(keyA: string, keyB: string): number {
  const dateA = new Date(keyA + "T00:00:00");
  const dateB = new Date(keyB + "T00:00:00");
  const ms = dateB.getTime() - dateA.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Streak milestones that grant bonus XP rewards. */
export const STREAK_MILESTONES: number[] = [3, 7, 14, 30, 60, 100];

/** XP reward for hitting a given streak milestone. */
export function getStreakReward(streakCount: number): number {
  if (streakCount >= 100) return 500;
  if (streakCount >= 60) return 300;
  if (streakCount >= 30) return 200;
  if (streakCount >= 14) return 120;
  if (streakCount >= 7) return 75;
  if (streakCount >= 3) return 40;
  return 0;
}

/** Returns the list of milestones that have been reached for a given streak count. */
export function getReachedMilestones(streakCount: number): number[] {
  return STREAK_MILESTONES.filter((m) => streakCount >= m);
}

/** Returns the next upcoming milestone for a given streak count, or null if all reached. */
export function getNextMilestone(streakCount: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (streakCount < m) return m;
  }
  return null;
}

/**
 * Compute new streak state after a challenge is completed on a given day.
 * Returns null if the streak didn't change (e.g. same-day completion).
 */
export type StreakUpdate = {
  streakCount: number;
  longestStreak: number;
  lastStreakDate: string;
  streakHistory: string[];
  milestoneReached: number | null;
  rewardXp: number;
};

export function computeStreakUpdate(params: {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  streakHistory: string[];
  completedDateKey: string;
}): StreakUpdate {
  const { currentStreak, longestStreak, lastStreakDate, streakHistory, completedDateKey } = params;

  // Already completed a challenge today — streak unchanged
  if (lastStreakDate === completedDateKey) {
    return {
      streakCount: currentStreak,
      longestStreak,
      lastStreakDate: lastStreakDate ?? completedDateKey,
      streakHistory,
      milestoneReached: null,
      rewardXp: 0,
    };
  }

  let newStreak: number;
  if (lastStreakDate === null) {
    // First ever completion
    newStreak = 1;
  } else {
    const diff = dayDiff(lastStreakDate, completedDateKey);
    if (diff === 1) {
      // Consecutive day — increment
      newStreak = currentStreak + 1;
    } else if (diff <= 0) {
      // Same day or weird clock skew — no change
      newStreak = currentStreak;
    } else {
      // Gap — reset streak
      newStreak = 1;
    }
  }

  const newLongest = Math.max(longestStreak, newStreak);
  const newHistory = [...streakHistory, completedDateKey].slice(-365);

  // Check if a new milestone was crossed
  const prevMilestone = getReachedMilestones(currentStreak).length;
  const newMilestoneCount = getReachedMilestones(newStreak).length;
  const milestoneReached = newMilestoneCount > prevMilestone ? STREAK_MILESTONES[newMilestoneCount - 1] : null;
  const rewardXp = milestoneReached !== null ? getStreakReward(milestoneReached) : 0;

  return {
    streakCount: newStreak,
    longestStreak: newLongest,
    lastStreakDate: completedDateKey,
    streakHistory: newHistory,
    milestoneReached,
    rewardXp,
  };
}

/**
 * Check if the streak should be broken because the user missed a day.
 * Called on app open — if lastStreakDate is more than 1 day before today, reset to 0.
 */
export function checkStreakBreak(lastStreakDate: string | null, today: string): number | null {
  if (!lastStreakDate) return null;
  const diff = dayDiff(lastStreakDate, today);
  if (diff > 1) {
    // Streak broken — return 0 as the new streak count
    return 0;
  }
  return null;
}

/** Last 7 days as date keys, ending today. */
export function getLast7Days(today: string): string[] {
  const result: string[] = [];
  const baseDate = new Date(today + "T00:00:00");
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    result.push(toDateKey(d));
  }
  return result;
}

/** Day-of-week label (M, T, W...) for a date key. */
export function getDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  return labels[d.getDay()];
}
