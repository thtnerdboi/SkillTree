import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "skilltree-offline-queue-v1";

export type QueuedAction =
  | {
      type: "TOGGLE_CHALLENGE";
      challengeId: string;
      nodeId: string;
      xp: number;
      timestamp: number;
    }
  | {
      type: "UPSERT_USER";
      userId: string;
      name: string;
      inviteCode: string;
      weeklyCompletion: number;
      timestamp: number;
    };

export async function enqueueAction(action: QueuedAction): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const existing: QueuedAction[] = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    existing.push(action);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    console.log("[offline-queue] Enqueued action:", action.type, "queue size:", existing.length);
  } catch (err) {
    console.error("[offline-queue] Failed to enqueue:", err);
  }
}

export async function drainQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const actions: QueuedAction[] = JSON.parse(raw) as QueuedAction[];
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log("[offline-queue] Drained", actions.length, "actions");
    return actions;
  } catch (err) {
    console.error("[offline-queue] Failed to drain:", err);
    return [];
  }
}

export async function peekQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
