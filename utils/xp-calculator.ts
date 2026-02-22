import {
  SKILL_NODES,
  NODE_COMPLETION_XP,
  LEVEL_COMPLETION_XP,
  USER_LEVEL_THRESHOLDS,
  getNodesForLevel,
} from "@/mocks/mvp-data";
import type { Challenge } from "@/mocks/mvp-data";

export type ChallengeProgressMap = Record<string, boolean>;
export type AiChallengesMap = Record<string, Challenge[]>;

export type XpDeltaResult = {
  xpDelta: number;
  nodeJustCompleted: boolean;
  levelJustCompleted: boolean;
  completedLevelNumber: number | null;
};

export function getEffectiveChallenges(
  nodeId: string,
  aiChallenges: AiChallengesMap
): Challenge[] {
  const node = SKILL_NODES.find((n) => n.id === nodeId);
  if (!node) return [];
  const ai = aiChallenges[nodeId];
  return ai && ai.length > 0 ? ai : node.defaultChallenges;
}

export function isNodeDone(
  nodeId: string,
  progress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): boolean {
  const challenges = getEffectiveChallenges(nodeId, aiChallenges);
  return challenges.length > 0 && challenges.every((c) => progress[c.id]);
}

export function isLevelDone(
  levelNumber: number,
  progress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): boolean {
  const nodes = getNodesForLevel(levelNumber);
  return nodes.length > 0 && nodes.every((n) => isNodeDone(n.id, progress, aiChallenges));
}

export function isTreeDone(
  progress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): boolean {
  return SKILL_NODES.every((node) => isNodeDone(node.id, progress, aiChallenges));
}

export function computeToggleXpDelta(
  challengeId: string,
  nodeId: string,
  challengeXp: number,
  currentProgress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): XpDeltaResult {
  const wasCompleted = currentProgress[challengeId] ?? false;
  const newProgress: ChallengeProgressMap = {
    ...currentProgress,
    [challengeId]: !wasCompleted,
  };

  let xpDelta = wasCompleted ? -challengeXp : challengeXp;
  let nodeJustCompleted = false;
  let levelJustCompleted = false;
  let completedLevelNumber: number | null = null;

  const node = SKILL_NODES.find((n) => n.id === nodeId);
  if (!node) return { xpDelta, nodeJustCompleted, levelJustCompleted, completedLevelNumber };

  const wasNodeComplete = isNodeDone(nodeId, currentProgress, aiChallenges);
  const isNodeComplete = isNodeDone(nodeId, newProgress, aiChallenges);

  if (!wasNodeComplete && isNodeComplete) {
    const bonus = NODE_COMPLETION_XP[node.levelNumber] ?? 150;
    xpDelta += bonus;
    nodeJustCompleted = true;

    const wasLevelComplete = isLevelDone(node.levelNumber, currentProgress, aiChallenges);
    const isLevelComplete = isLevelDone(node.levelNumber, newProgress, aiChallenges);

    if (!wasLevelComplete && isLevelComplete) {
      const levelBonus = LEVEL_COMPLETION_XP[node.levelNumber] ?? 500;
      xpDelta += levelBonus;
      levelJustCompleted = true;
      completedLevelNumber = node.levelNumber;
    }
  } else if (wasNodeComplete && !isNodeComplete) {
    xpDelta -= NODE_COMPLETION_XP[node.levelNumber] ?? 150;
  }

  return { xpDelta, nodeJustCompleted, levelJustCompleted, completedLevelNumber };
}

export function getUserLevelFromXp(xp: number): number {
  for (let i = USER_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= (USER_LEVEL_THRESHOLDS[i] ?? 0)) return i + 1;
  }
  return 1;
}

export function getXpProgressFraction(xp: number, userLevel: number): number {
  const current = USER_LEVEL_THRESHOLDS[userLevel - 1] ?? 0;
  const next =
    USER_LEVEL_THRESHOLDS[userLevel] ??
    USER_LEVEL_THRESHOLDS[USER_LEVEL_THRESHOLDS.length - 1] ??
    0;
  if (next <= current) return 1;
  return Math.min((xp - current) / (next - current), 1);
}

export function computeWeeklyCompletion(
  progress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): number {
  let completed = 0;
  let total = 0;
  for (const node of SKILL_NODES) {
    const challenges = getEffectiveChallenges(node.id, aiChallenges);
    total += challenges.length;
    completed += challenges.filter((c) => progress[c.id]).length;
  }
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function computeCompletedChallenges(
  progress: ChallengeProgressMap,
  aiChallenges: AiChallengesMap
): number {
  return SKILL_NODES.reduce((total, node) => {
    const challenges = getEffectiveChallenges(node.id, aiChallenges);
    return total + challenges.filter((c) => progress[c.id]).length;
  }, 0);
}

export function computeTotalChallenges(aiChallenges: AiChallengesMap): number {
  return SKILL_NODES.reduce((total, node) => {
    const challenges = getEffectiveChallenges(node.id, aiChallenges);
    return total + challenges.length;
  }, 0);
}
