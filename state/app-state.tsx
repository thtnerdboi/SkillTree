import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "../lib/trpc"; 

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

// --- Types ---
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

// --- Helpers ---
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
  const [lastSyncedCompletion, setLastSyncedCompletion] = useState(-1);

  // --- API / Persistence ---
  const upsertUser = trpc.social.upsertUser.useMutation();

  const storedQuery = useQuery({
    queryKey: ["arcstep-v5"],
    queryFn: async () => {
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

  // Sync Pro status from backend automatically
  const userQuery = trpc.social.getUser.useQuery(
    { userId: state.userId },
    { enabled: state.isAuthed && !!state.userId }
  );

  useEffect(() => {
    if (userQuery.data && userQuery.data.isPro !== state.isPro) {
      updateState(curr => ({ ...curr, isPro: userQuery.data.isPro }));
    }
  }, [userQuery.data]);

  useEffect(() => {
    if (storedQuery.data) {
      const base = createDefaultState();
      setState({ ...base, ...storedQuery.data });
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

  // --- Core Actions ---
  const signIn = useCallback((name: string) => {
    updateState((current) => {
      const next = { ...current, isAuthed: true, displayName: name };
      // BUG 6 FIX: Immediate sync on sign in
      upsertUser.mutate({
        userId: next.userId,
        name: next.displayName,
        inviteCode: next.inviteCode,
        weeklyCompletion: 0,
      });
      return next;
    });
  }, [updateState, upsertUser]);

  const signOut = useCallback(() => {
    const fresh = createDefaultState();
    setState(fresh);
    persistMutation.mutate(fresh);
  }, [persistMutation]);

  const updateDisplayName = useCallback((name: string) => {
    updateState((current) => ({ ...current, displayName: name }));
  }, [updateState]);

  const completeOnboarding = useCallback((answers: OnboardingAnswers, challenges: Record<string, Challenge[]>) => {
    updateState((current) => {
      const next = {
        ...current,
        onboardingComplete: true,
        onboardingAnswers: answers,
        aiChallenges: challenges,
      };
      // BUG 6 FIX: Sync on onboarding complete
      upsertUser.mutate({
        userId: next.userId,
        name: next.displayName,
        inviteCode: next.inviteCode,
        weeklyCompletion: 0,
      });
      return next;
    });
  }, [updateState, upsertUser]);

  const toggleChallenge = useCallback((challengeId: string, nodeId: string, challengeXp: number) => {
    updateState((current) => {
      const wasCompleted = current.challengeProgress[challengeId] ?? false;
      const newProgress = { ...current.challengeProgress, [challengeId]: !wasCompleted };
      let xpDelta = !wasCompleted ? challengeXp : -challengeXp;

      const node = SKILL_NODES.find((n) => n.id === nodeId);
      if (node) {
        const nodeChallenges = (current.aiChallenges[nodeId] ?? []).length > 0 ? current.aiChallenges[nodeId] : node.defaultChallenges;
        const wasNodeComplete = nodeChallenges.every((c) => current.challengeProgress[c.id]);
        const isNodeComplete = nodeChallenges.every((c) => newProgress[c.id]);

        if (!wasNodeComplete && isNodeComplete) {
          xpDelta += NODE_COMPLETION_XP[node.levelNumber] ?? 150;
        } else if (wasNodeComplete && !isNodeComplete) {
          xpDelta -= NODE_COMPLETION_XP[node.levelNumber] ?? 150;
          // BUG 9 FIX: Handle Level reversal
          const levelNodes = getNodesForLevel(node.levelNumber);
          const wasLevelComplete = levelNodes.every(ln => ln.defaultChallenges.every(c => current.challengeProgress[c.id]));
          if (wasLevelComplete) xpDelta -= LEVEL_COMPLETION_XP[node.levelNumber] ?? 500;
        }
      }

      if (current.isPro && xpDelta > 0) xpDelta = Math.round(xpDelta * 1.5);

      return {
        ...current,
        challengeProgress: newProgress,
        xp: Math.max(0, current.xp + xpDelta),
      };
    });
  }, [updateState]);

  // --- Helper Methods ---
  const setAiChallenges = useCallback((nodeId: string, challenges: Challenge[]) => {
    updateState(c => ({ ...c, aiChallenges: { ...c.aiChallenges, [nodeId]: challenges } }));
  }, [updateState]);

  const addFriend = useCallback((code: string, name: string, weeklyCompletion: number) => {
    updateState(c => ({
      ...c,
      friends: [...c.friends, { id: `${code}-${Date.now()}`, name, inviteCode: code, weeklyCompletion: Math.max(0, Math.min(100, weeklyCompletion)) }]
    }));
  }, [updateState]);

  const triggerPrestige = useCallback(() => {
    setPrestigeReady(false);
    updateState(c => ({ ...c, prestigeCount: c.prestigeCount + 1, challengeProgress: {}, aiChallenges: {}, lastResetAt: Date.now(), prestigeDismissed: false }));
  }, [updateState]);

  const dismissPrestige = useCallback(() => {
    setPrestigeReady(false);
    updateState(c => ({ ...c, prestigeDismissed: true }));
  }, [updateState]);

  const addBonusXp = useCallback((amount: number) => {
    updateState(c => ({ ...c, xp: c.xp + amount }));
  }, [updateState]);

  const recordAiGeneration = useCallback((domainId: string) => {
    updateState(c => ({ ...c, lastAiGenTime: { ...c.lastAiGenTime, [domainId]: Date.now() } }));
  }, [updateState]);

  const setPro = useCallback((status: boolean) => {
    updateState(c => ({ ...c, isPro: status }));
  }, [updateState]);

  // --- Read Methods ---
  const isNodeComplete = useCallback((nodeId: string): boolean => {
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node) return false;
    const challenges = (state.aiChallenges[nodeId] ?? []).length > 0 ? state.aiChallenges[nodeId] : node.defaultChallenges;
    return challenges.every((c) => state.challengeProgress[c.id]);
  }, [state.challengeProgress, state.aiChallenges]);

  const isLevelUnlocked = useCallback((levelNumber: number): boolean => {
    if (levelNumber === 1) return true;
    return getNodesForLevel(levelNumber - 1).every((n) => isNodeComplete(n.id));
  }, [isNodeComplete]);

  const isNodeUnlocked = useCallback((nodeId: string): boolean => {
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    return node ? isLevelUnlocked(node.levelNumber) : false;
  }, [isLevelUnlocked]);

  // --- Computed Stats ---
  const isTreeComplete = useMemo(() => SKILL_NODES.every(node => isNodeComplete(node.id)), [isNodeComplete]);

  useEffect(() => {
    if (isTreeComplete && state.onboardingComplete && !state.prestigeDismissed) setPrestigeReady(true);
  }, [isTreeComplete, state.onboardingComplete, state.prestigeDismissed]);

  const totalChallenges = useMemo(() => {
    return SKILL_NODES.reduce((total, node) => total + ((state.aiChallenges[node.id] ?? []).length || node.defaultChallenges.length), 0);
  }, [state.aiChallenges]);

  const completedChallengesCount = useMemo(() => {
    return SKILL_NODES.reduce((total, node) => {
      const challenges = (state.aiChallenges[node.id] ?? []).length > 0 ? state.aiChallenges[node.id] : node.defaultChallenges;
      return total + challenges.filter(c => state.challengeProgress[c.id]).length;
    }, 0);
  }, [state.challengeProgress, state.aiChallenges]);

  const weeklyCompletion = totalChallenges > 0 ? Math.round((completedChallengesCount / totalChallenges) * 100) : 0;

  // BUG 7 FIX: Sync logic
  useEffect(() => {
    if (!state.isAuthed || !state.onboardingComplete) return;
    if (weeklyCompletion === lastSyncedCompletion) return;
    const handler = setTimeout(() => {
      upsertUser.mutate({ userId: state.userId, name: state.displayName || "Anonymous", inviteCode: state.inviteCode, weeklyCompletion });
      setLastSyncedCompletion(weeklyCompletion);
    }, 1500);
    return () => clearTimeout(handler);
  }, [weeklyCompletion, state.isAuthed, state.onboardingComplete, state.userId, state.displayName, state.inviteCode]);

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
    userLevel: getUserLevel(state.xp),
    prestigeRank: getPrestigeRank(state.prestigeCount),
    weeklyCompletion,
    completedChallengesCount,
    totalChallenges,
    leaderboard: useMemo(() => {
      const entries = [...state.friends, { id: "self", name: state.displayName || "You", inviteCode: state.inviteCode, weeklyCompletion }];
      return entries.sort((a, b) => b.weeklyCompletion - a.weeklyCompletion);
    }, [state.friends, state.displayName, state.inviteCode, weeklyCompletion]),
  };
});