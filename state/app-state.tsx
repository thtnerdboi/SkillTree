import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc, setTrpcAuthHeaders, clearTrpcAuthHeaders } from "../lib/trpc";
import { analytics } from "../utils/analytics";
import { ANALYTICS_EVENTS } from "../utils/event-types";
import {
  computeToggleXpDelta,
  computeCompletedChallenges,
  computeTotalChallenges,
  computeWeeklyCompletion,
  isNodeDone,
  isTreeDone,
  getUserLevelFromXp,
} from "../utils/xp-calculator";
import {
  Challenge,
  SKILL_NODES,
  TREE_LEVELS,
  getNodesForLevel,
  getPrestigeRank,
  getPrestigeXpMultiplier,
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
  aiGenerations: number;
  lastAiGenTime: Record<string, number>;
};

const STORAGE_KEY = "skilltree-state-v1";
const AUTH_SESSION_KEY = "skilltree-auth-v1";

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
  aiGenerations: 0,
  lastAiGenTime: {},
});

export const [AppStateProvider, useAppState] = createContextHook(() => {
  const [state, setState] = useState<StoredState>(createDefaultState());
  const [prestigeReady, setPrestigeReady] = useState<boolean>(false);
  const [pendingChallengeIds, setPendingChallengeIds] = useState<Record<string, boolean>>({});
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertUserMutation = trpc.social.upsertUser.useMutation({
    onSuccess: () => console.log("[state] User synced to backend"),
    onError: (e) => console.log("[state] Backend sync failed:", e.message),
  });

  const completedChallengesQuery = trpc.progress.getCompletedChallenges.useQuery(
    { userId: state.userId },
    {
      enabled: state.isAuthed && Boolean(state.userId),
      staleTime: 30_000,
    }
  );

  const addCompletedChallengeMutation = trpc.progress.addCompletedChallenge.useMutation({
    onError: (e) => console.log("[state] Save completed challenge failed:", e.message),
  });

  const storedQuery = useQuery({
    queryKey: ["skilltree-v1"],
    queryFn: async () => {
      console.log("[state] Loading app state from storage");
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsedState = stored ? (JSON.parse(stored) as StoredState) : null;
      if (!parsedState?.userId || !parsedState?.isAuthed) {
        try {
          const authJson = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
          if (authJson) {
            const auth = JSON.parse(authJson) as Partial<StoredState>;
            console.log("[state] Restored auth session from SecureStore, userId:", auth.userId);
            return { ...createDefaultState(), ...auth } as StoredState;
          }
        } catch (err) {
          console.log("[state] SecureStore read failed:", err);
        }
      }
      return parsedState;
    },
  });

  const persistMutation = useMutation({
    mutationFn: async (nextState: StoredState) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return nextState;
    },
    onError: (e) => console.error("[state] Persist failed:", e),
  });

  useEffect(() => {
    if (storedQuery.data) {
      console.log("[state] Hydrating app state");
      const base = createDefaultState();
      const hydrated: StoredState = {
        ...base,
        ...storedQuery.data,
        challengeProgress: storedQuery.data.challengeProgress ?? {},
        aiChallenges: storedQuery.data.aiChallenges ?? {},
        friends: storedQuery.data.friends ?? [],
        xp: storedQuery.data.xp ?? 0,
        prestigeCount: storedQuery.data.prestigeCount ?? 0,
        isPro: storedQuery.data.isPro ?? false,
        aiGenerations: storedQuery.data.aiGenerations ?? 0,
      };
      setState(hydrated);
      if (hydrated.isAuthed && hydrated.userId) {
        setTrpcAuthHeaders(hydrated.userId, hydrated.inviteCode);
        analytics.identify(hydrated.userId, {
          name: hydrated.displayName,
          prestigeCount: hydrated.prestigeCount,
        });
      }
    }
  }, [storedQuery.data]);

  useEffect(() => {
    if (!state.isAuthed || !completedChallengesQuery.data) return;

    const remoteProgress: Record<string, boolean> = {};
    completedChallengesQuery.data.forEach((entry) => {
      remoteProgress[entry.challengeId] = true;
    });

    setState((current) => ({
      ...current,
      challengeProgress: {
        ...current.challengeProgress,
        ...remoteProgress,
      },
    }));
  }, [state.isAuthed, completedChallengesQuery.data]);

  const updateState = useCallback(
    (updater: (current: StoredState) => StoredState) => {
      setState((current) => {
        const next = updater(current);
        persistMutation.mutate(next);
        if (next.isAuthed && next.userId && next.inviteCode) {
          const authData = JSON.stringify({
            isAuthed: next.isAuthed,
            userId: next.userId,
            inviteCode: next.inviteCode,
            displayName: next.displayName,
          });
          SecureStore.setItemAsync(AUTH_SESSION_KEY, authData).catch(
            (e) => console.log("[state] SecureStore write failed:", e)
          );
          setTrpcAuthHeaders(next.userId, next.inviteCode);
        }
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
      analytics.track(ANALYTICS_EVENTS.SIGN_IN, { name });
    },
    [updateState]
  );

  const signOut = useCallback(() => {
    console.log("[state] Sign out");
    analytics.track(ANALYTICS_EVENTS.SIGN_OUT);
    analytics.reset();
    clearTrpcAuthHeaders();
    const fresh = createDefaultState();
    setState(fresh);
    persistMutation.mutate(fresh);
    SecureStore.deleteItemAsync(AUTH_SESSION_KEY).catch(() => {});
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
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        nodeCount: Object.keys(challenges).length,
      });
    },
    [updateState]
  );

  const setPro = useCallback(
    (value: boolean) => {
      console.log("[state] Set isPro:", value);
      updateState((current) => (current.isPro === value ? current : { ...current, isPro: value }));
    },
    [updateState]
  );

  const toggleChallenge = useCallback(
    (challengeId: string, nodeId: string, challengeXp: number) => {
      console.log("[state] Toggle challenge:", challengeId, "node:", nodeId);

      const wasCompleted = state.challengeProgress[challengeId] ?? false;

      updateState((current) => {
        const { xpDelta, nodeJustCompleted, levelJustCompleted, completedLevelNumber } =
          computeToggleXpDelta(
            challengeId,
            nodeId,
            challengeXp,
            current.challengeProgress,
            current.aiChallenges
          );

        const currentlyCompleted = current.challengeProgress[challengeId] ?? false;
        const newProgress = {
          ...current.challengeProgress,
          [challengeId]: !currentlyCompleted,
        };

        const prestigeMultiplier = getPrestigeXpMultiplier(current.prestigeCount);
        const proMultiplier = current.isPro ? 1.5 : 1;
        const finalMultiplier = prestigeMultiplier * proMultiplier;
        const finalXpDelta = xpDelta > 0 ? Math.round(xpDelta * finalMultiplier) : xpDelta;

        const eventName = currentlyCompleted
          ? ANALYTICS_EVENTS.CHALLENGE_UNCOMPLETED
          : ANALYTICS_EVENTS.CHALLENGE_COMPLETED;
        analytics.track(eventName, { challengeId, nodeId, xp: challengeXp, isPro: current.isPro });

        if (nodeJustCompleted) {
          console.log("[state] Node complete! xpDelta:", finalXpDelta);
          analytics.track(ANALYTICS_EVENTS.NODE_COMPLETED, { nodeId });
        }
        if (levelJustCompleted && completedLevelNumber !== null) {
          console.log("[state] Level complete! level:", completedLevelNumber);
          analytics.track(ANALYTICS_EVENTS.LEVEL_COMPLETED, {
            levelNumber: completedLevelNumber,
          });
        }

        return {
          ...current,
          challengeProgress: newProgress,
          xp: Math.max(0, current.xp + finalXpDelta),
        };
      });

      if (wasCompleted || !state.userId || !state.isAuthed) return;

      setPendingChallengeIds((current) => ({ ...current, [challengeId]: true }));
      addCompletedChallengeMutation.mutate(
        {
          userId: state.userId,
          challengeId,
          nodeId,
          challengeXp,
        },
        {
          onSettled: () => {
            setPendingChallengeIds((current) => {
              const next = { ...current };
              delete next[challengeId];
              return next;
            });
          },
        }
      );
    },
    [updateState, state.challengeProgress, state.userId, state.isAuthed, addCompletedChallengeMutation]
  );

  const isChallengeSaving = useCallback(
    (challengeId: string) => Boolean(pendingChallengeIds[challengeId]),
    [pendingChallengeIds]
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

  const recordAiGeneration = useCallback(
    (domainId?: string) => {
      console.log("[state] AI generation recorded");
      updateState((current) => ({
        ...current,
        aiGenerations: current.aiGenerations + 1,
        lastAiGenTime: domainId
          ? {
              ...current.lastAiGenTime,
              [domainId]: Date.now(),
            }
          : current.lastAiGenTime,
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
    analytics.track(ANALYTICS_EVENTS.PRESTIGE_TRIGGERED, {
      newPrestigeCount: state.prestigeCount + 1,
    });
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
    analytics.track(ANALYTICS_EVENTS.PRESTIGE_DISMISSED);
    setPrestigeReady(false);
  }, []);

  const addBonusXp = useCallback(
    (amount: number) => {
      console.log("[state] Add bonus XP:", amount);
      analytics.track(ANALYTICS_EVENTS.AD_REWARD_CLAIMED, { xpAmount: amount });
      updateState((current) => {
        const prestigeMultiplier = getPrestigeXpMultiplier(current.prestigeCount);
        const proMultiplier = current.isPro ? 1.5 : 1;
        const finalAmount = Math.round(amount * prestigeMultiplier * proMultiplier);
        console.log("[state] Bonus XP with multiplier:", finalAmount, "isPro:", current.isPro, "prestigeCount:", current.prestigeCount);
        return { ...current, xp: current.xp + finalAmount };
      });
    },
    [updateState]
  );

  const isNodeComplete = useCallback(
    (nodeId: string): boolean => {
      return isNodeDone(nodeId, state.challengeProgress, state.aiChallenges);
    },
    [state.challengeProgress, state.aiChallenges]
  );

  const isLevelUnlocked = useCallback(
    (levelNumber: number): boolean => {
      if (levelNumber === 1) return true;
      const currentLevelNodes = getNodesForLevel(levelNumber);
      return currentLevelNodes.some((node) => {
        if (node.parentIds.length === 0) return true;
        return node.parentIds.every((parentId) =>
          isNodeDone(parentId, state.challengeProgress, state.aiChallenges)
        );
      });
    },
    [state.challengeProgress, state.aiChallenges]
  );

  const isNodeUnlocked = useCallback(
    (nodeId: string): boolean => {
      const node = SKILL_NODES.find((n) => n.id === nodeId);
      if (!node) return false;
      if (node.parentIds.length === 0) return true;
      return node.parentIds.every((parentId) =>
        isNodeDone(parentId, state.challengeProgress, state.aiChallenges)
      );
    },
    [state.challengeProgress, state.aiChallenges]
  );

  const isTreeComplete = useMemo(() => {
    return isTreeDone(state.challengeProgress, state.aiChallenges);
  }, [state.challengeProgress, state.aiChallenges]);

  useEffect(() => {
    if (isTreeComplete && state.onboardingComplete) {
      console.log("[state] Tree complete! Prestige ready.");
      setPrestigeReady(true);
    }
  }, [isTreeComplete, state.onboardingComplete]);

  const completedChallenges = useMemo(() => {
    return computeCompletedChallenges(state.challengeProgress, state.aiChallenges);
  }, [state.challengeProgress, state.aiChallenges]);

  const totalChallenges = useMemo(() => {
    return computeTotalChallenges(state.aiChallenges);
  }, [state.aiChallenges]);

  const weeklyCompletion = useMemo(() => {
    return computeWeeklyCompletion(state.challengeProgress, state.aiChallenges);
  }, [state.challengeProgress, state.aiChallenges]);

  const weeklyCompletionForSync = weeklyCompletion;

  useEffect(() => {
    if (!state.isAuthed || !state.userId || !state.displayName || !state.inviteCode) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      console.log("[state] Auto-syncing user to backend");
      upsertUserMutation.mutate({
        userId: state.userId,
        name: state.displayName,
        inviteCode: state.inviteCode,
        weeklyCompletion: weeklyCompletionForSync,
      });
    }, 1500);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [state.isAuthed, state.userId, state.displayName, state.inviteCode, weeklyCompletionForSync, upsertUserMutation]);

  const completedNodes = useMemo(() => {
    return SKILL_NODES.filter((n) =>
      isNodeDone(n.id, state.challengeProgress, state.aiChallenges)
    ).length;
  }, [state.challengeProgress, state.aiChallenges]);

  const completedLevels = useMemo(() => {
    return TREE_LEVELS.filter((l) => {
      const nodes = getNodesForLevel(l.number);
      return nodes.every((n) =>
        isNodeDone(n.id, state.challengeProgress, state.aiChallenges)
      );
    }).length;
  }, [state.challengeProgress, state.aiChallenges]);

  const userLevel = getUserLevelFromXp(state.xp);
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

  return useMemo(
    () => ({
      state,
      isLoading: storedQuery.isLoading,
      signIn,
      signOut,
      updateDisplayName,
      completeOnboarding,
      toggleChallenge,
      isChallengeSaving,
      setAiChallenges,
      recordAiGeneration,
      addFriend,
      addBonusXp,
      setPro,
      triggerPrestige,
      dismissPrestige,
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
    }),
    [
      state,
      storedQuery.isLoading,
      signIn,
      signOut,
      updateDisplayName,
      completeOnboarding,
      toggleChallenge,
      isChallengeSaving,
      setAiChallenges,
      recordAiGeneration,
      addFriend,
      addBonusXp,
      setPro,
      triggerPrestige,
      dismissPrestige,
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
    ]
  );
});
