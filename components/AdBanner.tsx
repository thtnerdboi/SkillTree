import React from "react";
import { Platform, View, ViewStyle } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

type AdBannerProps = {
  style?: ViewStyle;
};

// TODO: Create banner ad units in your AdMob dashboard and replace these placeholder
// unit IDs with your real ones. Keep the TestIds branches for __DEV__ — they always
// serve test ads so the emulator/simulator never hits your live inventory.
const BANNER_UNIT_ID = Platform.select({
  android: __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-5851180331769845/REPLACE_ANDROID_BANNER_UNIT",
  ios: __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-5851180331769845/REPLACE_IOS_BANNER_UNIT",
})!;

export function AdBanner({ style }: AdBannerProps) {
  return (
    <View style={style}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) =>
          console.warn("[AdBanner] Failed to load:", error.message)
        }
      />
    </View>
  );
}

// Kept for any future interstitial placements.
export function AdInterstitial() {
  return null;
}
