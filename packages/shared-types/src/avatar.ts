export type SkinTone =
  | "porcelain"
  | "fair"
  | "tan"
  | "brown"
  | "deep"
  | "pastel-violet";

export type FaceShape = "round" | "oval" | "square" | "cat";

export type EyeStyle = "normal" | "happy" | "wink" | "sleepy" | "wide" | "cool";

export type BrowStyle = "neutral" | "raised" | "angry" | "soft";

export type MouthStyle =
  | "smile"
  | "grin"
  | "surprised"
  | "smirk"
  | "cat_smile"
  | "neutral";

export type HairOrTop =
  | "none"
  | "spiky"
  | "bob"
  | "curly"
  | "cap"
  | "beanie"
  | "horns"
  | "sprout";

export const BG_COLORS = [
  "#E8FF47",
  "#FF6B6B",
  "#4ECDC4",
  "#9B5DE5",
  "#F15BB5",
  "#00BBF9",
  "#FEE440",
  "#F3722C",
] as const;

export type BgColor = (typeof BG_COLORS)[number];

export interface AvatarConfig {
  skinTone: SkinTone;
  faceShape: FaceShape;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  hairOrTop: HairOrTop;
  bgColor: BgColor;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone: "tan",
  faceShape: "round",
  eyes: "happy",
  brows: "neutral",
  mouth: "smile",
  hairOrTop: "spiky",
  bgColor: "#E8FF47",
};

export function isValidAvatarConfig(value: unknown): value is AvatarConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const skinTones: SkinTone[] = [
    "porcelain",
    "fair",
    "tan",
    "brown",
    "deep",
    "pastel-violet",
  ];
  const faceShapes: FaceShape[] = ["round", "oval", "square", "cat"];
  const eyeStyles: EyeStyle[] = [
    "normal",
    "happy",
    "wink",
    "sleepy",
    "wide",
    "cool",
  ];
  const browStyles: BrowStyle[] = ["neutral", "raised", "angry", "soft"];
  const mouthStyles: MouthStyle[] = [
    "smile",
    "grin",
    "surprised",
    "smirk",
    "cat_smile",
    "neutral",
  ];
  const hairOptions: HairOrTop[] = [
    "none",
    "spiky",
    "bob",
    "curly",
    "cap",
    "beanie",
    "horns",
    "sprout",
  ];

  return (
    skinTones.includes(v.skinTone as SkinTone) &&
    faceShapes.includes(v.faceShape as FaceShape) &&
    eyeStyles.includes(v.eyes as EyeStyle) &&
    browStyles.includes(v.brows as BrowStyle) &&
    mouthStyles.includes(v.mouth as MouthStyle) &&
    hairOptions.includes(v.hairOrTop as HairOrTop) &&
    (BG_COLORS as readonly string[]).includes(v.bgColor as string)
  );
}
