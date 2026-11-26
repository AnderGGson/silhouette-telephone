import type { AvatarConfig } from "@silhouette/shared-types";

const SKIN_TONES = [
  ["porcelain", "#FCE4C2"],
  ["fair", "#F3D5B5"],
  ["tan", "#D8A777"],
  ["brown", "#C68642"],
  ["deep", "#8D5D34"],
  ["pastel-violet", "#C6B3F5"],
] as const;

const FACE_SHAPES = [
  ["round", "M8 44a16 16 0 0 1 32 0 16 16 0 0 1-32 0Z"],
  ["oval", "M16 28a14 16 0 0 1 20 0 14 16 0 0 1-20 0Z"],
  ["square", "M10 32h24v14H10z"],
  ["cat", "M8 36a8 10 0 0 0 16 0 8 10 0 0 0-16 0Z"],
] as const;

const EYES = [
  ["normal", "circle"],
  ["happy", "path"],
  ["wink", "circle"],
  ["sleepy", "path"],
  ["wide", "circle"],
  ["cool", "path"],
] as const;

const BROWS = [
  ["neutral", "path"],
  ["raised", "path"],
  ["angry", "path"],
  ["soft", "path"],
] as const;

const MOUTHS = [
  ["smile", "path"],
  ["grin", "path"],
  ["surprised", "circle"],
  ["smirk", "path"],
  ["cat_smile", "path"],
  ["neutral", "path"],
] as const;

const HAIR = [
  ["none", "none"],
  ["spiky", "spiky"],
  ["bob", "bob"],
  ["curly", "curly"],
  ["cap", "cap"],
  ["beanie", "beanie"],
  ["horns", "horns"],
  ["sprout", "sprout"],
] as const;

interface AvatarRendererProps {
  config: AvatarConfig;
  size?: number;
}

/**
 * Renderiza un avatar de forma (sin nombre) desde su `AvatarConfig`.
 * Pure SVG: skinTone, faceShape, eyes, brows, mouth, hairOrTop y bgColor.
 */
export function AvatarRenderer({ config, size = 64 }: AvatarRendererProps) {
  const r = size / 2;
  const face = r - 2;

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Avatar">
      <circle cx={32} cy={32} r={r} fill={config.bgColor} />
      <g fill={SKIN_TONES.find(([v]) => v === config.skinTone)?.[1] ?? SKIN_TONES[2][1]}>
        {/* Face shape */}
        {config.faceShape === "round" ? (
          <ellipse cx={32} cy={36} rx={face - 2} ry={face - 8} fill="currentColor" />
        ) : (
          <circle cx={32} cy={36} r={face - 6} fill="currentColor" />
        )}
        {/* Eyes */}
        {config.eyes === "wink" ? (
          <ellipse cx={24} cy={34} rx={3} ry={1.2} fill="#222" />
        ) : (
          <circle cx={24} cy={34} r={3} fill="#222" />
        )}
        {config.eyes === "normal" ? (
          <circle cx={40} cy={34} r={3} fill="#222" />
        ) : (
          <circle cx={40} cy={34} r={3} fill="#222" opacity="0.6" />
        )}
        {config.eyes === "happy" && (
          <path d="M16 41c2-2.5 4-3.5 6-3.5s4 1.5 6 3.5" fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round" />
        )}
        {config.eyes === "sleepy" && (
          <path d="M16 41c2 2.5 4 3.5 6 3.5s4-1.5 6-3.5" fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round" />
        )}
        {config.eyes === "wide" && <circle cx={32} cy={37} r={2.4} fill="#222" />}
        {/* Brows */}
        <path d="M12 25q7-2 14 0" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M52 25q-7-2-14 0" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* Mouth */}
        {config.mouth === "smile" && (
          <path d="M26 45q4 3 8 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {config.mouth === "grin" && (
          <path d="M26 45q4 5 8 0q4 5 8 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {config.mouth === "surprised" && (
          <circle cx={32} cy={48} r={4} fill="#222" />
        )}
        {config.mouth === "smirk" && (
          <path d="M24 46q5 2 10 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {config.mouth === "cat_smile" && (
          <path d="M26 45c4-2 12-2 16 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {config.mouth === "neutral" && (
          <path d="M28 46h8" stroke="#222" strokeWidth="2" strokeLinecap="round" />
        )}
      </g>
      {/* Hair / top */}
      <g fill={`var(--hair-color, #0d0d16)`}>
        {config.hairOrTop === "spiky" && (
          <g>
            {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70].map((x) => (
              <path key={x} d={`M${x} 12v${14 - Math.abs((x - 32) / 2)}L${x + 2} 2L${x + 4} 14Z`} />
            ))}
          </g>
        )}
        {config.hairOrTop === "bob" && <path d="M8 30q8-6 16 0q8-6 16 0Q48 30 32 42Q16 30 8 30Z" />}
        {config.hairOrTop === "curly" && (
          <path d="M14 28c3-4 8-4 11 0c2-4 7-4 9 0c2-4 5-4 7 0c-1-3-3-6-6-7c-3 1-6 4-7 7c-3-1-6-1-9 0c-1-3-3-5-6-5c3 4 3 10 0 14" fill="none" strokeWidth="3" strokeLinecap="round" />
        )}
        {config.hairOrTop === "cap" && (
          <path d="M8 26h16c0-4 6-6 12 0h12v10c-6 0-8 2-10 2c0 4-4 2-8 2c0-4-2-2-4 0c-4 4-4 8 0 8H8z" />
        )}
        {config.hairOrTop === "beanie" && (
          <path d="M24 12v6c-8 1-14 1-16-1l4-4c-3 2 0 0-3 2l-3 3c6-2 14-2 20 0l-2-6z" />
        )}
        {config.hairOrTop === "horns" && (
          <g>
            <path d="M14 24c4-8 12-8 16 0c2-4 6-4 8 0" />
            <path d="M14 24c4-4 10-4 12 0c2-4 4-4 6 0" transform="translate(0 8)" />
          </g>
        )}
        {config.hairOrTop === "sprout" && (
          <path d="M20 32c2-4 4-4 6 0c2-4 4-4 6 0c0 0 0 12 0 12c0 4-2 6-4 6c-2 0-4-2-4-6c0-4-2-12 0-12c-2 0-4-2-4-2z" />
        )}
      </g>
    </svg>
  );
}

export const AVATAR_SCHEMA = {
  SKIN_TONES: SKIN_TONES.map(([v]) => v),
  FACE_SHAPES: FACE_SHAPES.map(([v]) => v),
  EYES: EYES.map(([v]) => v),
  BROWS: BROWS.map(([v]) => v),
  MOUTHS: MOUTHS.map(([v]) => v),
  HAIR: HAIR.map(([v]) => v),
} as const;
