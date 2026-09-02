import { PRESTIGE_RANKS } from "../mocks/mvp-data";
import type { AvatarConfig } from "../components/PixelAvatar";

export type AvatarPreset = AvatarConfig;

const BASE_AVATAR: Omit<AvatarPreset, "outfitColor"> = {
  skinTone: 3,
  hairStyle: "short",
  hairColor: "black",
  eyeColor: "black",
  outfitStyle: "blue",
};

export function getAvatarForRank(prestigeRank: number): AvatarPreset {
  const safeRank = Number.isFinite(prestigeRank)
    ? Math.max(0, Math.floor(prestigeRank))
    : 0;

  for (let index = PRESTIGE_RANKS.length - 1; index >= 0; index -= 1) {
    const rank = PRESTIGE_RANKS[index];
    if (safeRank >= rank.minPrestige) {
      return { ...BASE_AVATAR, outfitColor: rank.color };
    }
  }

  return { ...BASE_AVATAR, outfitColor: PRESTIGE_RANKS[0].color };
}
