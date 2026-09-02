import React from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";

export type SkinTone = 1 | 2 | 3 | 4 | 5 | 6;
export type HairStyle = "short" | "long";
export type HairColor = "black" | "blonde" | "brunette";
export type EyeColor = "black" | "blue";
export type OutfitStyle = "blue" | "olive+white" | "red" | "suit";
export type HexColor = `#${string}`;

export type PixelAvatarProps = {
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  outfitColor: HexColor;
  eyeColor?: EyeColor;
  outfitStyle?: OutfitStyle;
  size?: number;
};

export type AvatarConfig = Required<Omit<PixelAvatarProps, "size">>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone: 3,
  hairStyle: "short",
  hairColor: "black",
  eyeColor: "black",
  outfitStyle: "blue",
  outfitColor: "#FFD60A",
};

const SKIN_ASSETS: Record<SkinTone, ImageSourcePropType> = {
  1: require("../assets/characters/skin/tone_1.png"),
  2: require("../assets/characters/skin/tone_2.png"),
  3: require("../assets/characters/skin/tone_3.png"),
  4: require("../assets/characters/skin/tone_4.png"),
  5: require("../assets/characters/skin/tone_5.png"),
  6: require("../assets/characters/skin/tone_6.png"),
};

const HAIR_ASSETS: Record<
  HairStyle,
  Record<HairColor, ImageSourcePropType>
> = {
  short: {
    black: require("../assets/characters/hair/black.png"),
    blonde: require("../assets/characters/hair/blonde.png"),
    brunette: require("../assets/characters/hair/brunette.png"),
  },
  long: {
    black: require("../assets/characters/hair/black_f.png"),
    blonde: require("../assets/characters/hair/blonde_f.png"),
    brunette: require("../assets/characters/hair/brunette_f.png"),
  },
};

const EYE_ASSETS: Record<EyeColor, ImageSourcePropType> = {
  black: require("../assets/characters/eyes/black.png"),
  blue: require("../assets/characters/eyes/blue.png"),
};

const OUTFIT_ASSETS: Record<OutfitStyle, ImageSourcePropType> = {
  blue: require("../assets/characters/clothes/blue.png"),
  "olive+white": require("../assets/characters/clothes/olive+white.png"),
  red: require("../assets/characters/clothes/red.png"),
  suit: require("../assets/characters/clothes/suit.png"),
};

export function PixelAvatar({
  skinTone,
  hairStyle,
  hairColor,
  outfitColor,
  eyeColor = "black",
  outfitStyle = "blue",
  size = 64,
}: PixelAvatarProps) {
  const frame = { width: size, height: size };
  const layer = [StyleSheet.absoluteFill, frame];

  return (
    <View collapsable={false} style={[styles.frame, frame]}>
      <Image
        source={SKIN_ASSETS[skinTone]}
        style={layer}
        resizeMode="contain"
        fadeDuration={0}
      />
      <Image
        source={EYE_ASSETS[eyeColor]}
        style={layer}
        resizeMode="contain"
        fadeDuration={0}
      />
      <Image
        source={HAIR_ASSETS[hairStyle][hairColor]}
        style={layer}
        resizeMode="contain"
        fadeDuration={0}
      />
      <Image
        source={OUTFIT_ASSETS[outfitStyle]}
        style={[
          layer,
          // blue.png is the clean, single-colour silhouette verified with the
          // core Image tint path. Multi-colour outfits retain their authored pixels.
          outfitStyle === "blue" ? { tintColor: outfitColor } : undefined,
        ]}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    flexShrink: 0,
    overflow: "visible",
  },
});
