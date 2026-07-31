import React from "react";
import { Platform, View, ViewStyle } from "react-native";
import Constants from "expo-constants";

// react-native-google-mobile-ads is a native module — unavailable in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === "expo";

type AdBannerProps = {
  style?: ViewStyle;
};

// TODO: Create banner ad units in your AdMob dashboard and replace these placeholder
// unit IDs with your real ones. Keep the TestIds branches for __DEV__ — they always
// serve test ads so the emulator/simulator never hits your live inventory.
const BANNER_UNIT_ID = Platform.select({
  android: __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-5851180331769845/4361964831",
  ios: __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-5851180331769845/4267065252",
})!;

export function AdBanner({ style }: AdBannerProps) {
  if (IS_EXPO_GO) return null;

  try {
    const { BannerAd, BannerAdSize, TestIds: T } = require("react-native-google-mobile-ads");
    const unitId = Platform.select({
      android: __DEV__ ? T.BANNER : "ca-app-pub-5851180331769845/4361964831",
      ios: __DEV__ ? T.BANNER : "ca-app-pub-5851180331769845/4267065252",
    })!;
    return (
      <View style={style}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(error: Error) =>
            console.warn("[AdBanner] Failed to load:", error.message)
          }
        />
      </View>
    );
  } catch {
    return null;
  }
}

// Kept for any future interstitial placements.
export function AdInterstitial() {
  return null;
}
