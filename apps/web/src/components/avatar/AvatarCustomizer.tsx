"use client";

import { useState } from "react";
import { AvatarRenderer } from "./AvatarRenderer";
import { api } from "@/lib/game/roomClient";
import { DEFAULT_AVATAR_CONFIG } from "@silhouette/shared-types";
import type { AvatarConfig, BgColor, SkinTone, FaceShape, EyeStyle, BrowStyle, MouthStyle, HairOrTop } from "@silhouette/shared-types";

interface OptionGroup<T extends string> {
  key: keyof AvatarConfig;
  label: string;
  options: T[];
}

const GROUPS: OptionGroup<SkinTone | FaceShape | EyeStyle | BrowStyle | MouthStyle | HairOrTop | BgColor>[] = [
  { key: "skinTone", label: "Tono de piel", options: ["porcelain", "fair", "tan", "brown", "deep", "pastel-violet"] },
  { key: "faceShape", label: "Forma de cara", options: ["round", "oval", "square", "cat"] },
  { key: "eyes", label: "Ojos", options: ["normal", "happy", "wink", "sleepy", "wide", "cool"] },
  { key: "brows", label: "Cejas", options: ["neutral", "raised", "angry", "soft"] },
  { key: "mouth", label: "Boca", options: ["smile", "grin", "surprised", "smirk", "cat_smile", "neutral"] },
  { key: "hairOrTop", label: "Pelo / Top", options: ["none", "spiky", "bob", "curly", "cap", "beanie", "horns", "sprout"] },
  { key: "bgColor", label: "Color de fondo", options: ["#E8FF47", "#FF6B6B", "#4ECDC4", "#9B5DE5", "#F15BB5", "#00BBF9", "#FEE440", "#F3722C"] },
];

interface AvatarCustomizerProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

/**
 * Editor simple de avatar (Fase 4): botones por estilo, vista previa en vivo
 * y botones "Aleatorio" + "Guardar" (guarda en `profiles.avatar_config`).
 */
export function AvatarCustomizer({ value, onChange }: AvatarCustomizerProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <T extends keyof AvatarConfig>(key: T, next: AvatarConfig[T]) => {
    onChange({ ...value, [key]: next } as AvatarConfig);
    setMessage(null);
  };

  const randomize = () => {
    const next: AvatarConfig = {
      skinTone: ["porcelain", "fair", "tan", "brown", "deep", "pastel-violet"][Math.floor(Math.random() * 6)] as AvatarConfig["skinTone"],
      faceShape: ["round", "oval", "square", "cat"][Math.floor(Math.random() * 4)] as AvatarConfig["faceShape"],
      eyes: ["normal", "happy", "wink", "sleepy", "wide", "cool"][Math.floor(Math.random() * 6)] as AvatarConfig["eyes"],
      brows: ["neutral", "raised", "angry", "soft"][Math.floor(Math.random() * 4)] as AvatarConfig["brows"],
      mouth: ["smile", "grin", "surprised", "smirk", "cat_smile", "neutral"][Math.floor(Math.random() * 6)] as AvatarConfig["mouth"],
      hairOrTop: ["none", "spiky", "bob", "curly", "cap", "beanie", "horns", "sprout"][Math.floor(Math.random() * 8)] as AvatarConfig["hairOrTop"],
      bgColor: ["#E8FF47", "#FF6B6B", "#4ECDC4", "#9B5DE5", "#F15BB5", "#00BBF9", "#FEE440", "#F3722C"][Math.floor(Math.random() * 8)] as AvatarConfig["bgColor"],
    };
    onChange(next);
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile({ avatar_config: value });
      if (res?.profile) setMessage("Avatar guardado");
      else setMessage("Error al guardar");
    } catch {
      setMessage("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-6">
        <AvatarRenderer config={value} size={128} />
        <div className="flex flex-col gap-2">
          <button type="button" onClick={randomize} className="btn-ghost self-start">
            Aleatorio
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary self-start">
            {saving ? "Guardando..." : "Guardar avatar"}
          </button>
          {message && <span className="text-sm text-violet-300">{message}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-violet-200">{group.label}</label>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => update(group.key, option)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    value[group.key] === option
                      ? "bg-violet-600 border-violet-400 text-white"
                      : "bg-white/5 border-white/10 text-violet-200 hover:bg-white/10"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_AVATAR_CONFIG };
