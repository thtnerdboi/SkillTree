export type StoredUser = {
  id: string;
  name: string;
  inviteCode: string;
  weeklyCompletion: number;
  updatedAt: number;
  stripeCustomerId?: string;
  isPro: boolean; // 👈 New: Track their Pro status securely!
};

export type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: number;
};

type Store = {
  users: Record<string, StoredUser>;
  inviteIndex: Record<string, string>;
  friendRequests: Record<string, FriendRequest>;
  friendships: Record<string, Set<string>>;
};

const store: Store = {
  users: {},
  inviteIndex: {},
  friendRequests: {},
  friendships: {},
};

const getFriendSet = (userId: string) => {
  if (!store.friendships[userId]) {
    store.friendships[userId] = new Set<string>();
  }
  return store.friendships[userId];
};

export const storeApi = {
  upsertUser: (user: StoredUser) => {
    const existing = store.inviteIndex[user.inviteCode];
    if (existing && existing !== user.id) {
      throw new Error("Invite code already in use");
    }
    // Default isPro to false if it's somehow missing
    const userToSave = { ...user, isPro: user.isPro ?? false };
    
    store.users[user.id] = userToSave;
    store.inviteIndex[user.inviteCode] = user.id;
    return userToSave;
  },
  getUser: (userId: string) => store.users[userId],
  findUserByInvite: (inviteCode: string) => {
    const id = store.inviteIndex[inviteCode];
    return id ? store.users[id] : undefined;
  },
  // 👈 New: The webhook needs to find users using only their Stripe ID
  findUserByStripeId: (stripeCustomerId: string) => {
    return Object.values(store.users).find((u) => u.stripeCustomerId === stripeCustomerId);
  },
  addFriendRequest: (fromUserId: string, toUserId: string) => {
    const id = `req_${Date.now()}_${Math.round(Math.random() * 1000)}`;
    const request: FriendRequest = {
      id,
      fromUserId,
      toUserId,
      createdAt: Date.now(),
    };
    store.friendRequests[id] = request;
    return request;
  },
  listFriendRequests: (userId: string) => {
    return Object.values(store.friendRequests).filter(
      (request) => request.toUserId === userId
    );
  },
  removeFriendRequest: (requestId: string) => {
    delete store.friendRequests[requestId];
  },
  addFriendship: (a: string, b: string) => {
    getFriendSet(a).add(b);
    getFriendSet(b).add(a);
  },
  listFriends: (userId: string) => {
    return Array.from(getFriendSet(userId));
  },
  areFriends: (a: string, b: string) => {
    return getFriendSet(a).has(b);
  },
};