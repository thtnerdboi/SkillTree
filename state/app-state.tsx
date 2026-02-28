import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "../lib/trpc"; // Make sure to import your tRPC client!

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
  prestigeDismissed: boolean;
};

const STORAGE_KEY = "arcstep-state-v6";

// BUG 8 FIX: More robust invite codes
const generateUniqueInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ARC-${result}`;
};

const createDefaultState = (): StoredState => ({
  isAuthed: false,
  userId: `usr_${Date.now()}_${Math.round(Math.random() * 10000)}`,
  displayName: "",
  inviteCode: generateUniqueInviteCode(),
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
  prestigeDismissed: false,
});

export const [AppStateProvider, useAppState] = createContextHook(() => {
  const [state, setState] = useState<StoredState>(createDefaultState());
  const [prestigeReady, setPrestigeReady] = useState<boolean>(false);

  const upsertUser = trpc.social.upsertUser.useMutation();

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

  // BUG 10 FIX: Check if they are Pro on the backend when the app loads
  const userQuery = trpc.social.getUser.useQuery(
    { userId: state.userId },
    { enabled: state.isAuthed && !!state.userId }
  );

  useEffect(() => {
    if (userQuery.data && userQuery.data.isPro !== state.isPro) {
      console.log("[state] 🔄 Restoring Pro status from backend!");
      setState(curr => {
        const next = { ...curr, isPro: userQuery.data.isPro };
        persistMutation.mutate(next);
        return next;
      });
    }
  }, [userQuery.data]);

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
        prestigeDismissed: storedQuery.data.prestigeDismissed ?? false,
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
      console.log("[state] Complete onboarding");
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
      updateState((current) => {
        const wasCompleted = current.challengeProgress[challengeId] ?? false;
        const newProgress = {
          ...current.challengeProgress,
          [challengeId]: !wasCompleted,
        };

        let xpDelta = 0;
        if (!wasCompleted) xpDelta += challengeXp;
        else xpDelta -= challengeXp;

        const node = SKILL_NODES.find((n) => n.id === nodeId);
        if (node) {
          const nodeChallenges =
            (current.aiChallenges[nodeId] ?? []).length > 0
              ? current.aiChallenges[nodeId]
              : node.defaultChallenges;

          const wasNodeComplete = nodeChallenges.every((c) => current.challengeProgress[c.id]);
          const isNodeComplete = nodeChallenges.every((c) => newProgress[c.id]);

          if (!wasNodeComplete && isNodeComplete) {
            xpDelta += NODE_COMPLETION_XP[node.levelNumber] ?? 150;
            const levelNodes = getNodesForLevel(node.levelNumber);
            const wasLevelComplete = levelNodes.every((ln) => {
              const lnChallenges = (current.aiChallenges[ln.id] ?? []).length > 0 ? current.aiChallenges[ln.id] : ln.defaultChallenges;
              return lnChallenges.every((c) => current.challengeProgress[c.id]);
            });
            const isLevelComplete = levelNodes.every((ln) => {
              const lnChallenges = (current.aiChallenges[ln.id] ?? []).length > 0 ? current.aiChallenges[ln.id] : ln.defaultChallenges;
              return lnChallenges.every((c) => newProgress[c.id]);
            });
            if (!wasLevelComplete && isLevelComplete) {
              xpDelta += LEVEL_COMPLETION_XP[node.levelNumber] ?? 500;
            }
          } else if (wasNodeComplete && !isNodeComplete) {
            xpDelta -= NODE_COMPLETION_XP[node.levelNumber] ?? 150;
            const levelNodes = getNodesForLevel(node.levelNumber);
            const wasLevelComplete = levelNodes.every((ln) => {
              const lnChallenges = (current.aiChallenges[ln.id] ?? []).length > 0 ? current.aiChallenges[ln.id] : ln.defaultChallenges;
              return lnChallenges.every((c) => current.challengeProgress[c.id]);
            });
            const isLevelComplete = levelNodes.every((ln) => {
              const lnChallenges = (current.aiChallenges[ln.id] ?? []).length > 0 ? current.aiChallenges[ln.id] : ln.defaultChallenges;
              return lnChallenges.every((c) => newProgress[c.id]);
            });
            if (wasLevelComplete && !isLevelComplete) {
              xpDelta -= LEVEL_COMPLETION_XP[node.levelNumber] ?? 500;
            }
          }
        }

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
    setPrestigeReady(false);
    updateState((current) => ({
      ...current,
      prestigeCount: current.prestigeCount + 1,
      challengeProgress: {},
      aiChallenges: {},
      lastResetAt: Date.now(),
      prestigeDismissed: false,
    }));
  }, [updateState, state.prestigeCount]);

  const dismissPrestige = useCallback(() => {
    setPrestigeReady(false);
    updateState((current) => ({
      ...current,
      prestigeDismissed: true,
    }));
  }, [updateState]);

  const addBonusXp = useCallback(
    (amount: number) => {
      updateState((current) => ({ ...current, xp: current.xp + amount }));
    },
    [updateState]
  );

  const recordAiGeneration = useCallback((domainId: string) => {
    updateState((current) => ({
      ...current,
      lastAiGenTime: {
        ...current.lastAiGenTime,
        [domainId]: Date.now(),
      },
    }));
  }, [updateState]);

  const setPro = useCallback((status: boolean) => {
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
    if (isTreeComplete && state.onboardingComplete && !state.prestigeDismissed) {
      setPrestigeReady(true);
    }
  }, [isTreeComplete, state.onboardingComplete, state.prestigeDismissed]);

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

  // BUG 7 FIX: Debounced Sync to Backend
  const [lastSyncedCompletion, setLastSyncedCompletion] = useState(-1);

  useEffect(() => {
    if (!state.isAuthed || !state.onboardingComplete) return;
    if (weeklyCompletion === lastSyncedCompletion) return;

    const handler = setTimeout(() => {
      console.log(`[state] 🔄 Syncing profile and ${weeklyCompletion}% completion to Supabase...`);
      upsertUser.mutate({
        userId: state.userId,
        name: state.displayName || "Anonymous",
        inviteCode: state.inviteCode,
        weeklyCompletion: weeklyCompletion,
      });
      setLastSyncedCompletion(weeklyCompletion);
    }, 1500);

    return () => clearTimeout(handler);
  }, [weeklyCompletion, state.isAuthed, state.onboardingComplete, state.userId, state.displayName, state.inviteCode]);

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
    setPro, 
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