import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import Colors from "@/constants/colors";
import {
  PixelAvatar,
  type AvatarConfig,
  type EyeColor,
  type HairColor,
  type HairStyle,
  type HexColor,
  type OutfitStyle,
  type SkinTone,
} from "@/components/PixelAvatar";

type AvatarCustomizerProps = {
  value: AvatarConfig;
  onChange: (value: AvatarConfig) => void;
};

const SKIN_TONES: SkinTone[] = [1, 2, 3, 4, 5, 6];
const HAIR_STYLES: HairStyle[] = ["short", "long"];
const HAIR_COLORS: HairColor[] = ["black", "blonde", "brunette"];
const EYE_COLORS: EyeColor[] = ["black", "blue"];
const OUTFIT_STYLES: OutfitStyle[] = ["blue", "olive+white", "red", "suit"];
const OUTFIT_COLORS: HexColor[] = ["#FFD60A", "#45E9FF", "#FF5C5C", "#FF9FF3", "#72F1B8", "#F4F1DE"];
const EYE_LABELS: Record<EyeColor, string> = { black: "Black", blue: "Blue" };

const LABELS: Record<HairStyle | HairColor | EyeColor | OutfitStyle, string> = {
  short: "Crop",
  long: "Long",
  black: "Black",
  blonde: "Gold",
  brunette: "Brown",
  blue: "Arcade",
  "olive+white": "Field",
  red: "Cherry",
  suit: "Suit",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {children}
      </ScrollView>
    </View>
  );
}

function TextOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.textOption, selected && styles.optionSelected, pressed && styles.optionPressed]}
    >
      <Text style={[styles.textOptionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function AvatarCustomizer({ value, onChange }: AvatarCustomizerProps) {
  const update = useCallback(<K extends keyof AvatarConfig>(key: K, nextValue: AvatarConfig[K]) => {
    Haptics.selectionAsync();
    onChange({ ...value, [key]: nextValue });
  }, [onChange, value]);

  return (
    <View style={styles.wrap}>
      <View style={styles.previewFrame}>
        <View pointerEvents="none" style={styles.previewRailTop} />
        <View pointerEvents="none" style={styles.previewRailBottom} />
        <View pointerEvents="none" style={[styles.pellet, styles.pelletLeft]} />
        <View pointerEvents="none" style={[styles.pellet, styles.pelletRight]} />
        <View style={styles.previewStage}>
          <View style={styles.previewAvatarSlot}>
            <PixelAvatar {...value} size={240} />
          </View>
        </View>
        <View style={styles.readyTag}>
          <Check size={10} color={Colors.light.background} strokeWidth={3} />
          <Text style={styles.readyText}>PLAYER READY</Text>
        </View>
      </View>

      <Section title="Skin tone">
        {SKIN_TONES.map((skinTone) => (
          <Pressable
            key={skinTone}
            accessibilityRole="radio"
            accessibilityLabel={`Skin tone ${skinTone}`}
            accessibilityState={{ checked: value.skinTone === skinTone }}
            onPress={() => update("skinTone", skinTone)}
            style={({ pressed }) => [styles.spriteOption, value.skinTone === skinTone && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <PixelAvatar {...value} skinTone={skinTone} size={44} />
          </Pressable>
        ))}
      </Section>

      <Section title="Hair shape">
        {HAIR_STYLES.map((hairStyle) => (
          <TextOption key={hairStyle} label={LABELS[hairStyle]} selected={value.hairStyle === hairStyle} onPress={() => update("hairStyle", hairStyle)} />
        ))}
      </Section>

      <Section title="Hair colour">
        {HAIR_COLORS.map((hairColor) => (
          <Pressable
            key={hairColor}
            accessibilityRole="radio"
            accessibilityLabel={`${LABELS[hairColor]} hair`}
            accessibilityState={{ checked: value.hairColor === hairColor }}
            onPress={() => update("hairColor", hairColor)}
            style={({ pressed }) => [styles.spriteOption, value.hairColor === hairColor && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <PixelAvatar {...value} hairColor={hairColor} size={44} />
          </Pressable>
        ))}
      </Section>

      <Section title="Eyes">
        {EYE_COLORS.map((eyeColor) => (
          <TextOption key={eyeColor} label={EYE_LABELS[eyeColor]} selected={value.eyeColor === eyeColor} onPress={() => update("eyeColor", eyeColor)} />
        ))}
      </Section>

      <Section title="Outfit">
        {OUTFIT_STYLES.map((outfitStyle) => (
          <Pressable
            key={outfitStyle}
            accessibilityRole="radio"
            accessibilityLabel={`${LABELS[outfitStyle]} outfit`}
            accessibilityState={{ checked: value.outfitStyle === outfitStyle }}
            onPress={() => update("outfitStyle", outfitStyle)}
            style={({ pressed }) => [styles.outfitOption, value.outfitStyle === outfitStyle && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <PixelAvatar {...value} outfitStyle={outfitStyle} size={46} />
            <Text style={[styles.outfitLabel, value.outfitStyle === outfitStyle && styles.optionLabelSelected]}>{LABELS[outfitStyle]}</Text>
          </Pressable>
        ))}
      </Section>

      {value.outfitStyle === "blue" ? (
        <Section title="Arcade outfit colour">
          {OUTFIT_COLORS.map((outfitColor) => (
            <Pressable
              key={outfitColor}
              accessibilityRole="radio"
              accessibilityLabel={`Outfit colour ${outfitColor}`}
              accessibilityState={{ checked: value.outfitColor === outfitColor }}
              onPress={() => update("outfitColor", outfitColor)}
              style={({ pressed }) => [styles.colorOption, { backgroundColor: outfitColor }, value.outfitColor === outfitColor && styles.colorSelected, pressed && styles.optionPressed]}
            >
              {value.outfitColor === outfitColor ? <Check size={14} color={Colors.light.background} strokeWidth={3} /> : null}
            </Pressable>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  previewFrame: {
    height: 316,
    backgroundColor: Colors.light.surfaceDeep,
    borderWidth: 2,
    borderColor: Colors.light.arcadeBlue,
    overflow: "hidden",
    position: "relative",
  },
  previewStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 44,
  },
  previewAvatarSlot: { width: 240, height: 240, alignItems: "center", justifyContent: "center" },
  previewRailTop: { position: "absolute", top: 10, left: 10, right: 10, height: 3, backgroundColor: Colors.light.arcadeBlue },
  previewRailBottom: { position: "absolute", bottom: 10, left: 10, right: 10, height: 3, backgroundColor: Colors.light.arcadeBlue },
  pellet: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.tint, top: "50%" },
  pelletLeft: { left: 18 },
  pelletRight: { right: 18 },
  readyTag: { position: "absolute", bottom: 18, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.light.tint },
  readyText: { fontFamily: "monospace", fontSize: 9, lineHeight: 11, fontWeight: "900", letterSpacing: 1, color: Colors.light.background },
  section: { gap: 9 },
  sectionTitle: { fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase", color: Colors.light.muted },
  optionRow: { gap: 9, paddingRight: 4 },
  spriteOption: { width: 54, height: 54, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: Colors.light.border },
  outfitOption: { minWidth: 74, paddingHorizontal: 8, paddingVertical: 6, alignItems: "center", gap: 2, backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: Colors.light.border },
  outfitLabel: { fontFamily: "monospace", fontSize: 9, fontWeight: "800", color: Colors.light.muted },
  textOption: { minWidth: 78, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: Colors.light.border },
  textOptionLabel: { fontFamily: "monospace", fontSize: 11, fontWeight: "800", color: Colors.light.muted },
  optionSelected: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tintSoft },
  optionLabelSelected: { color: Colors.light.text },
  optionPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  colorOption: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: Colors.light.surfaceDeep },
  colorSelected: { borderColor: Colors.light.text },
});
