"use client";

import { useState } from "react";
import { api, type GameState } from "@/lib/game/roomClient";
import { SilhouetteViewer } from "../canvas/SilhouetteViewer";
import type { VoteCategory } from "@silhouette/shared-types";

interface RevealAndVotePhaseProps {
  state: GameState | null;
}

/**
 * Fase 4 de `REVEAL_AND_VOTE`: revela la cadena activa paso a paso y permite
 * emitir votos por categoría (`faithful`, `funny`, `plot_twist`).
 */
export function RevealAndVotePhase({ state }: RevealAndVotePhaseProps) {
  const room = state?.room;
  const [voted, setVoted] = useState<Record<VoteCategory, boolean>>({
    faithful: false,
    funny: false,
    plot_twist: false,
  });

  if (!room || room.status !== "REVEAL_AND_VOTE") return null;
  const chain = room.active_reveal_chain;
  const chainSteps = (state?.steps ?? [])
    .filter((s) => s.chain_index === chain)
    .sort((a, b) => a.step_number - b.step_number);
  const concept = state?.concepts.find((c) => c.chain_index === chain)?.text;

  const submit = async (category: VoteCategory) => {
    if (!state) return;
    try {
      await api.submitVotes(state.room.id, chain, [{ category }]);
      setVoted((v) => ({ ...v, [category]: true }));
    } catch {
      /* los errores se ignoran por simplicidad; el realtime actualiza */
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full px-4">
      <h2 className="text-2xl font-bold text-violet-100">Revelación de la cadena {chain + 1}</h2>
      <p className="text-xl text-violet-300">{concept ?? ""}</p>
      <div className="flex flex-col gap-4 w-full max-w-xl">
        {chainSteps.map((step) => (
          <div key={step.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-sm text-violet-300 italic">
              {step.step_number === 1 ? "(concepto inicial)" : step.guess_text ? `¿Qué viste? → ${step.guess_text}` : ""}
            </p>
            <SilhouetteViewer src={step.silhouette_image_path} />
            {step.original_image_path && (
              <img src={step.original_image_path} alt="Dibujo original" className="max-h-32 object-contain rounded-xl border border-white/10" />
            )}
            {step.auto_points > 0 || step.vote_points > 0 ? (
              <p className="text-xs text-violet-400">
                Puntos automáticos: {step.auto_points}, por votos: {step.vote_points}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="font-semibold text-violet-200">Vota en esta cadena</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {(["faithful", "funny", "plot_twist"] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => void submit(category)}
              disabled={voted[category]}
              className="btn-primary"
            >
              {category === "faithful" ? "Más fiel al original" : category === "funny" ? "El más gracioso" : "Giro más inesperado"}
              {voted[category] ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
