import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { UserPlus, Users, Copy, Check, Clock, Info } from "lucide-react-native";
import * as ExpoClipboard from "expo-clipboard";

import Colors from "@/constants/colors";
import { trpc } from "@/lib/trpc";
import { useAppState } from "@/state/app-state";

export default function FriendsScreen() {
  const { state } = useAppState();
  const [code, setCode] = useState<string>("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestIsError, setRequestIsError] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const isReady = Boolean(state.userId && state.displayName && state.inviteCode);

  const sendRequest = trpc.social.sendFriendRequest.useMutation();
  const acceptRequest = trpc.social.acceptFriendRequest.useMutation();

  const requestsQuery = trpc.social.getFriendRequests.useQuery(
    { userId: state.userId },
    { enabled: isReady, refetchInterval: 8000 }
  );

  const circleQuery = trpc.social.getCircleStats.useQuery(
    { userId: state.userId },
    { enabled: isReady, refetchInterval: 8000 }
  );

  const friendEntries = useMemo(() => {
    return (circleQuery.data ?? []).filter((f) => f.userId !== state.userId);
  }, [circleQuery.data, state.userId]);

  const handleCopy = () => {
    ExpoClipboard.setStringAsync(state.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendRequest = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setRequestMessage("Enter an invite code.");
      setRequestIsError(true);
      return;
    }
    if (trimmed === state.inviteCode) {
      setRequestMessage("That's your own code!");
      setRequestIsError(true);
      return;
    }
    if (!isReady) {
      setRequestMessage("Finish onboarding first.");
      setRequestIsError(true);
      return;
    }
    setRequestMessage(null);
    sendRequest.mutate(
      { fromUserId: state.userId, toInviteCode: trimmed },
      {
        onSuccess: (result) => {
          setCode("");
          setRequestIsError(false);
          if (result.status === "requested") {
            setRequestMessage("✓ Request sent! They'll see it when they open Friends.");
          } else if (result.status === "already_friends") {
            setRequestMessage("You're already friends.");
          } else {
            setRequestMessage("Request already pending.");
          }
          requestsQuery.refetch();
        },
        onError: (error) => {
          console.log("Friend request failed", error.message);
          setRequestIsError(true);
          setRequestMessage(
            error.message.includes("not found")
              ? "No user found with that code. Make sure they've opened the app."
              : error.message
          );
        },
      }
    );
  };

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>SKILLTREE</Text>
            <Text style={styles.title}>Friends</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>YOUR INVITE CODE</Text>
            <View style={styles.inviteRow}>
              <Text style={styles.inviteText}>{state.inviteCode}</Text>
              <Pressable
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                onPress={handleCopy}
                testID="invite-code"
              >
                {copied ? (
                  <Check size={14} color="#060810" strokeWidth={2.5} />
                ) : (
                  <Copy size={14} color={Colors.light.tint} strokeWidth={2} />
                )}
                <Text style={[styles.copyText, copied && styles.copyTextDone]}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.hintRow}>
              <Info size={11} color="#2A3560" strokeWidth={2} />
              <Text style={styles.cardSub}>
                Both people must open the app before adding each other
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <UserPlus size={14} color={Colors.light.tint} strokeWidth={2} />
              <Text style={styles.cardLabel}>ADD A FRIEND</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Their invite code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(t) => {
                  setCode(t);
                  setRequestMessage(null);
                }}
                placeholder="ARC-123456"
                placeholderTextColor="#2A3560"
                autoCapitalize="characters"
                autoCorrect={false}
                testID="friend-code"
              />
            </View>
            {requestMessage ? (
              <Text
                style={[styles.statusText, requestIsError ? styles.statusError : styles.statusSuccess]}
                testID="friend-request-message"
              >
                {requestMessage}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                (!code.trim() || sendRequest.isPending) && styles.actionBtnDisabled,
              ]}
              onPress={handleSendRequest}
              disabled={sendRequest.isPending || !code.trim()}
              testID="add-friend"
            >
              {sendRequest.isPending ? (
                <ActivityIndicator size="small" color="#060810" />
              ) : (
                <Text style={styles.actionBtnText}>Send Request</Text>
              )}
            </TouchableOpacity>
          </View>

          {requestsQuery.data && requestsQuery.data.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Clock size={14} color="#FF6A4D" strokeWidth={2} />
                <Text style={[styles.cardLabel, { color: "#FF6A4D" }]}>
                  PENDING REQUESTS
                </Text>
              </View>
              {requestsQuery.data.map((request) => (
                <View key={request.id} style={styles.requestRow}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.friendName}>{request.fromName}</Text>
                    <Text style={styles.friendCode}>{request.fromInviteCode}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => {
                      acceptRequest.mutate(
                        { userId: state.userId, requestId: request.id },
                        { 
                          onSuccess: () => {
                            // BUG 9 FIX: Refetch BOTH requests and circle instantly 
                            requestsQuery.refetch();
                            circleQuery.refetch();
                          }
                        }
                      );
                    }}
                    testID={`accept-${request.id}`}
                  >
                    <Text style={styles.acceptBtnText}>
                      {acceptRequest.isPending ? "..." : "Accept"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Users size={14} color={Colors.light.tint} strokeWidth={2} />
              <Text style={styles.cardLabel}>YOUR CIRCLE</Text>
            </View>
            {circleQuery.isLoading ? (
              <Text style={styles.emptyText}>Loading circle...</Text>
            ) : friendEntries.length === 0 ? (
              <Text style={styles.emptyText}>
                Add someone to start a friendly sprint.
              </Text>
            ) : (
              friendEntries.map((friend) => (
                <View key={friend.userId} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendCode}>{friend.inviteCode}</Text>
                  </View>
                  <View style={styles.friendStat}>
                    <Text style={styles.friendPct}>{friend.weeklyCompletion}%</Text>
                    <Text style={styles.friendStatLabel}>this week</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#060810" },
  safeArea: { flex: 1 },
  scroll: { padding: 22, paddingBottom: 40, gap: 16 },
  header: { paddingBottom: 4 },
  brand: { fontSize: 11, letterSpacing: 3, color: Colors.light.tint, fontWeight: "700", textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "800", color: Colors.light.text, marginTop: 4 },
  card: { backgroundColor: "#0C1120", borderRadius: 22, padding: 20, gap: 14, borderWidth: 1, borderColor: "#1A2238" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: Colors.light.muted, fontWeight: "700" },
  cardSub: { fontSize: 12, color: "#2A3560", flex: 1 },
  inviteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#080B14", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: `${Colors.light.tint}30` },
  inviteText: { fontSize: 20, fontWeight: "800", color: Colors.light.text, letterSpacing: 2 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0C1628", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: `${Colors.light.tint}40` },
  copyBtnDone: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  copyText: { fontSize: 12, fontWeight: "700", color: Colors.light.tint },
  copyTextDone: { color: "#060810" },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: Colors.light.muted, fontWeight: "600" },
  input: { backgroundColor: "#080B14", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.light.text, borderWidth: 1, borderColor: "#1A2238" },
  actionBtn: { backgroundColor: Colors.light.tint, borderRadius: 14, paddingVertical: 14, alignItems: "center", shadowColor: Colors.light.tint, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 15, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },
  statusText: { fontSize: 13, color: Colors.light.muted, textAlign: "center" },
  statusSuccess: { color: Colors.light.success },
  statusError: { color: "#FF6B6B" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  requestRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#080B14", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "#FF6A4D20" },
  requestInfo: { flex: 1 },
  acceptBtn: { backgroundColor: "#FF6A4D", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  acceptBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#080B14", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "#141C2E" },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.light.tint}18`, borderWidth: 1.5, borderColor: `${Colors.light.tint}40`, alignItems: "center", justifyContent: "center" },
  friendAvatarText: { fontSize: 15, fontWeight: "800", color: Colors.light.tint },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: "700", color: Colors.light.text },
  friendCode: { fontSize: 11, color: "#2A3560", marginTop: 2, fontWeight: "600", letterSpacing: 0.5 },
  friendStat: { alignItems: "flex-end" },
  friendPct: { fontSize: 18, fontWeight: "800", color: Colors.light.tint },
  friendStatLabel: { fontSize: 10, color: "#2A3560", fontWeight: "600" },
  emptyText: { fontSize: 13, color: "#2A3560", textAlign: "center", paddingVertical: 8, fontWeight: "500" },
});