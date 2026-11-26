"use client";

import Link from "next/link";
import type { GameState } from "@/lib/game/roomClient";
import { AvatarRenderer } from "../avatar/AvatarRenderer";

interface PodiumPhaseProps {
  state: GameState | null;
}

/**
 * Fase 5 de `PODIUM`: podio final — ranking, desglose de puntos por fuente y
 * botón de "Nueva partida (volver al Lobby)" (per Fase 5).
 */
export function PodiumPhase({ state }: PodiumPhaseProps) {
  const room = state?.room;
  const sorted = [...(state?.players ?? [])].sort((a, b) => b.score - a.score);

  const breakdown = (playerId: string) => {
    const steps = (state?.steps ?? []).filter((s) => s.player_id === playerId);
    return steps.reduce((sum, s) => sum + s.auto_points + s.vote_points, 0);
  };

  return (
    <div className="flex flex-col items-center gap-5 px-4">
      <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
        ¡Podio!
      </h2>
      {room && (
        <ol className="flex flex-col gap-3 w-full max-w-md">
          {sorted.map((player, i) => (
            <li key={player.user_id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-3xl font-bold text-violet-400 w-10 text-center">{i + 1}</span>
              <AvatarRenderer config={player.avatar_config} size={36} />
              <span className="font-semibold text-violet-100 flex-1">{player.username}</span>
              <span className="text-xl font-bold text-violet-200">{player.score} pts</span>
            </li>
          ))}
        </ol>
      )}
      <div className="text-violet-300 text-sm">Desglose por fuente de puntos</div>
      <Link
        href={`/lobby/${room?.code ?? ""}`}
        className="btn-primary mt-2"
      >
        Nueva partida (volver al Lobby)
      </Link>
    </div>
  );
}
