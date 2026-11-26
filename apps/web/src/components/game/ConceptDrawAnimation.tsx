"use client";

import { useEffect, useState } from "react";
import { AvatarRenderer } from "../avatar/AvatarRenderer";
import type { GameState } from "@/lib/game/roomClient";

interface ConceptDrawAnimationProps {
  state: GameState | null;
}

/** Animación corta de sorteo: los 3 conceptos seleccionados se muestran uno a uno. */
export function ConceptDrawAnimation({ state }: ConceptDrawAnimationProps) {
  const selected = state?.concepts.filter((c) => c.is_selected).map((c) => c.text) ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (selected.length === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % selected.length), 3000);
    return () => clearInterval(id);
  }, [selected.length]);

  return (
    <div className="flex flex-col items-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-bold text-violet-100">Sorteando los conceptos...</h2>
      {selected.length > 0 ? (
        <>
          <p className="text-6xl font-black text-violet-100 animate-pulse" key={index}>
            {selected[index]}
          </p>
          <p className="text-sm text-violet-300">{index + 1}/{selected.length}</p>
        </>
      ) : (
        <p className="text-violet-300">Esperando asignación de sala...</p>
      )}
    </div>
  );
}
