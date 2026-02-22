import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Challenge,
  LEVEL_COMPLETION_XP,
  NODE_COMPLETION_XP,
  SKILL_NODES,
  TREE_LEVELS,
  getUserLevel,
  getPrestigeRank,
  getNodesForLevel,
} from "../mocks/mvp-data";

export type OnboardingAnswers = {
  body: string;
  mind: string;
  craft: string;
};

export type Friend = {
  id: string;
  name: string;
  inviteCode: string;
  weeklyCompletion: number;
};

export type StoredState = {
  isAuthed: boolean;
  userId: string;
  displayName: string;
  inviteCode: string;
  onboardingComplete: boolean;
  onboardingAnswers: OnboardingAnswers | null;
  challengeProgress: Record<string, boolean>;
  aiChallenges: Record<string, Challenge[]>;
  xp: number;
  prestigeCount: number;
  friends: Friend[];
  lastResetAt: number;
  isPro: boolean;
  lastAiGenTime: Record<string, number>;
};

const STORAGE_KEY = "arcstep-state-v6";

const createDefaultState = (): StoredState => ({
  isAuthed: false,
  userId: `usr_${Date.now()}_${Math.round(Math.random() * 10000)}`,
  displayName: "",
  inviteCode: `ARC-${Math.floor(100000 + Math.random() * 900000)}`,
  onboardingComplete: false,
  onboardingAnswers: null,
  challengeProgress: {},
  aiChallenges: {},
  xp: 0,
  prestigeCount: 0,
  friends: [],
  lastResetAt: Date.now(),
  isPro: false,
  lastAiGenTime: {},
});

export const [AppStateProvider, useAppState] = createContextHook(() => {
  const [state, setState] = useState<StoredState>(createDefaultState());
  const [prestigeReady, setPrestigeReady] = useState<boolean>(false);

  const storedQuery = useQuery({
    queryKey: ["arcstep-v5"],
    queryFn: async () => {
      console.log("[state] Loading app state from storage");
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as StoredState) : null;
    },
  });

  const persistMutation = useMutation({
    mutationFn: async (nextState: StoredState) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return nextState;
    },
  });

  useEffect(() => {
    if (storedQuery.data) {
      console.log("[state] Hydrating app state");
      const base = createDefaultState();
      setState({
        ...base,
        ...storedQuery.data,
        challengeProgress: storedQuery.data.challengeProgress ?? {},
        aiChallenges: storedQuery.data.aiChallenges ?? {},
        friends: storedQuery.data.friends ?? [],
        xp: storedQuery.data.xp ?? 0,
        prestigeCount: storedQuery.data.prestigeCount ?? 0,
        isPro: storedQuery.data.isPro ?? false,
        lastAiGenTime: storedQuery.data.lastAiGenTime ?? {},
      });
    }
  }, [storedQuery.data]);

  const updateState = useCallback(
    (updater: (current: StoredState) => StoredState) => {
      setState((current) => {
        const next = updater(current);
        persistMutation.mutate(next);
        return next;
      });
    },
    [persistMutation]
  );

  const signIn = useCallback(
    (name: string) => {
      console.log("[state] Sign in:", name);
      updateState((current) => ({
        ...current,
        isAuthed: true,
        displayName: name,
      }));
    },
    [updateState]
  );

  const signOut = useCallback(() => {
    console.log("[state] Sign out");
    const fresh = createDefaultState();
    setState(fresh);
    persistMutation.mutate(fresh);
  }, [persistMutation]);

  const updateDisplayName = useCallback(
    (name: string) => {
      console.log("[state] Update display name:", name);
      updateState((current) => ({ ...current, displayName: name }));
    },
    [updateState]
  );

  const completeOnboarding = useCallback(
    (answers: OnboardingAnswers, challenges: Record<string, Challenge[]>) => {
      console.log("[state] Complete onboarding with AI challenges for", Object.keys(challenges).length, "nodes");
      updateState((current) => ({
        ...current,
        onboardingComplete: true,
        onboardingAnswers: answers,
        aiChallenges: challenges,
      }));
    },
    [updateState]
  );

  const toggleChallenge = useCallback(
    (challengeId: string, nodeId: string, challengeXp: number) => {
      console.log("[state] Toggle challenge:", challengeId, "node:", nodeId);
      updateState((current) => {
        const wasCompleted = current.challengeProgress[challengeId] ?? false;
        const newProgress = {
          ...current.challengeProgress,
          [challengeId]: !wasCompleted,
        };

        let xpDelta = 0;
        if (!wasCompleted) {
          xpDelta += challengeXp;
        } else {
          xpDelta -= challengeXp;
        }

        const node = SKILL_NODES.find((n) => n.id === nodeId);
        if (node) {
          const nodeChallenges =
            (current.aiChallenges[nodeId] ?? []).length > 0
              ? current.aiChallenges[nodeId]
              : node.defaultChallenges;

          const wasNodeComplete = nodeChallenges.every(
            (c) => current.challengeProgress[c.id]
          );
          const isNodeComplete = nodeChallenges.every(
            (c) => newProgress[c.id]
          );

          if (!wasNodeComplete && isNodeComplete) {
            xpDelta += NODE_COMPLETION_XP[node.levelNumber] ?? 150;
            console.log("[state] Node complete! Bonus XP:", NODE_COMPLETION_XP[node.levelNumber]);

            const levelNodes = getNodesForLevel(node.levelNumber);
            const wasLevelComplete = levelNodes.every((ln) => {
              const lnChallenges =
                (current.aiChallenges[ln.id] ?? []).length > 0
                  ? current.aiChallenges[ln.id]
                  : ln.defaultChallenges;
              return lnChallenges.every((c) => current.challengeProgress[c.id]);
            });
            const isLevelComplete = levelNodes.every((ln) => {
              const lnChallenges =
                (current.aiChallenges[ln.id] ?? []).length > 0
                  ? current.aiChallenges[ln.id]
                  : ln.defaultChallenges;
              return lnChallenges.every((c) => newProgress[c.id]);
            });

            if (!wasLevelComplete && isLevelComplete) {
              xpDelta += LEVEL_COMPLETION_XP[node.levelNumber] ?? 500;
              console.log("[state] Level complete! Bonus XP:", LEVEL_COMPLETION_XP[node.levelNumber]);
            }
          } else if (wasNodeComplete && !isNodeComplete) {
            xpDelta -= NODE_COMPLETION_XP[node.levelNumber] ?? 150;
          }
        }

        // Apply Pro multiplier locally!
        if (current.isPro && xpDelta > 0) {
           xpDelta = Math.round(xpDelta * 1.5);
        }

        return {
          ...current,
          challengeProgress: newProgress,
          xp: Math.max(0, current.xp + xpDelta),
        };
      });
    },
    [updateState]
  );

  const setAiChallenges = useCallback(
    (nodeId: string, challenges: Challenge[]) => {
      console.log("[state] Set AI challenges for node:", nodeId);
      updateState((current) => ({
        ...current,
        aiChallenges: {
          ...current.aiChallenges,
          [nodeId]: challenges,
        },
      }));
    },
    [updateState]
  );

  const addFriend = useCallback(
    (code: string, name: string, weeklyCompletion: number) => {
      console.log("[state] Add friend:", name, code);
      updateState((current) => ({
        ...current,
        friends: [
          ...current.friends,
          {
            id: `${code}-${Date.now()}`,
            name,
            inviteCode: code,
            weeklyCompletion: Math.max(0, Math.min(100, weeklyCompletion)),
          },
        ],
      }));
    },
    [updateState]
  );

  const triggerPrestige = useCallback(() => {
    console.log("[state] Prestige triggered! Count:", state.prestigeCount + 1);
    setPrestigeReady(false);
    updateState((current) => ({
      ...current,
      prestigeCount: current.prestigeCount + 1,
      challengeProgress: {},
      aiChallenges: {},
      lastResetAt: Date.now(),
    }));
  }, [updateState, state.prestigeCount]);

  const dismissPrestige = useCallback(() => {
    setPrestigeReady(false);
  }, []);

  const addBonusXp = useCallback(
    (amount: number) => {
      console.log("[state] Add bonus XP:", amount);
      updateState((current) => ({ ...current, xp: current.xp + amount }));
    },
    [updateState]
  );

  const recordAiGeneration = useCallback((domainId: string) => {
    console.log(`[state] Recording AI generation time for: ${domainId}`);
    updateState((current) => ({
      ...current,
      lastAiGenTime: {
        ...current.lastAiGenTime,
        [domainId]: Date.now(),
      },
    }));
  }, [updateState]);

  const updateProStatus = useCallback((status: boolean) => {
    console.log(`[state] Updating Pro Status to: ${status}`);
    updateState((current) => ({ ...current, isPro: status }));
  }, [updateState]);


  const isNodeComplete = useCallback(
    (nodeId: string): boolean => {
      const node = SKILL_NODES.find((n) => n.id === nodeId);
      if (!node) return false;
      const challenges =
        (state.aiChallenges[nodeId] ?? []).length > 0
          ? state.aiChallenges[nodeId]
          : node.defaultChallenges;
      return challenges.every((c) => state.challengeProgress[c.id]);
    },
    [state.challengeProgress, state.aiChallenges]
  );

  const isLevelUnlocked = useCallback(
    (levelNumber: number): boolean => {
      if (levelNumber === 1) return true;
      const prevNodes = getNodesForLevel(levelNumber - 1);
      return prevNodes.every((n) => isNodeComplete(n.id));
    },
    [isNodeComplete]
  );

  const isNodeUnlocked = useCallback(
    (nodeId: string): boolean => {
      const node = SKILL_NODES.find((n) => n.id === nodeId);
      if (!node) return false;
      return isLevelUnlocked(node.levelNumber);
    },
    [isLevelUnlocked]
  );

  const isTreeComplete = useMemo(() => {
    return SKILL_NODES.every((node) => {
      const challenges =
        (state.aiChallenges[node.id] ?? []).length > 0
          ? state.aiChallenges[node.id]
          : node.defaultChallenges;
      return challenges.every((c) => state.challengeProgress[c.id]);
    });
  }, [state.challengeProgress, state.aiChallenges]);

  useEffect(() => {
    if (isTreeComplete && state.onboardingComplete) {
      console.log("[state] Tree complete! Prestige ready.");
      setPrestigeReady(true);
    }
  }, [isTreeComplete, state.onboardingComplete]);

  const completedChallenges = useMemo(() => {
    return SKILL_NODES.reduce((total, node) => {
      const challenges =
        (state.aiChallenges[node.id] ?? []).length > 0
          ? state.aiChallenges[node.id]
          : node.defaultChallenges;
      return total + challenges.filter((c) => state.challengeProgress[c.id]).length;
    }, 0);
  }, [state.challengeProgress, state.aiChallenges]);

  const totalChallenges = useMemo(() => {
    return SKILL_NODES.reduce((total, node) => {
      const challenges =
        (state.aiChallenges[node.id] ?? []).length > 0
          ? state.aiChallenges[node.id]
          : node.defaultChallenges;
      return total + challenges.length;
    }, 0);
  }, [state.aiChallenges]);

  const completedNodes = useMemo(() => {
    return SKILL_NODES.filter((n) => isNodeComplete(n.id)).length;
  }, [isNodeComplete]);

  const completedLevels = useMemo(() => {
    return TREE_LEVELS.filter((l) => {
      const nodes = getNodesForLevel(l.number);
      return nodes.every((n) => isNodeComplete(n.id));
    }).length;
  }, [isNodeComplete]);

  const weeklyCompletion = totalChallenges > 0
    ? Math.round((completedChallenges / totalChallenges) * 100)
    : 0;

  const userLevel = getUserLevel(state.xp);
  const prestigeRank = getPrestigeRank(state.prestigeCount);

  const leaderboard = useMemo(() => {
    const entries: Friend[] = [
      ...state.friends,
      {
        id: "self",
        name: state.displayName || "You",
        inviteCode: state.inviteCode,
        weeklyCompletion,
      },
    ];
    return entries.sort((a, b) => b.weeklyCompletion - a.weeklyCompletion);
  }, [state.friends, state.displayName, state.inviteCode, weeklyCompletion]);

  return {
    state,
    signIn,
    signOut,
    updateDisplayName,
    completeOnboarding,
    toggleChallenge,
    setAiChallenges,
    addFriend,
    addBonusXp,
    triggerPrestige,
    dismissPrestige,
    recordAiGeneration,
    updateProStatus,
    isNodeComplete,
    isNodeUnlocked,
    isLevelUnlocked,
    isTreeComplete,
    prestigeReady,
    userLevel,
    prestigeRank,
    weeklyCompletion,
    completedChallenges,
    totalChallenges,
    completedNodes,
    completedLevels,
    leaderboard,
  };
});