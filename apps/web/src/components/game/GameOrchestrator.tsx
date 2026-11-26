"use client";

import { useRoomState } from "@/lib/game/roomClient";
import { ConceptSubmissionPhase } from "./ConceptSubmissionPhase";
import { ConceptDrawAnimation } from "./ConceptDrawAnimation";
import { TurnWorkspace } from "./TurnWorkspace";
import { RevealAndVotePhase } from "./RevealAndVotePhase";
import { PodiumPhase } from "./PodiumPhase";

interface GameOrchestratorProps {
  code: string;
}

/** Orquestador de partida: une el estado en vivo con la fase correspondiente a `rooms.status`. */
export function GameOrchestrator({ code }: GameOrchestratorProps) {
  const { state, refresh } = useRoomState(code);
  const room = state?.room;

  if (!room) {
    return <div className="p-8 text-center text-violet-300">Cargando sala...</div>;
  }

  switch (room.status) {
    case "CONCEPT_SUBMISSION":
      return <ConceptSubmissionPhase state={state} onSubmitted={() => void refresh()} />;
    case "CONCEPT_DRAW":
      return <ConceptDrawAnimation state={state} />;
    case "PLAYING_TURN":
      return <TurnWorkspace state={state} />;
    case "REVEAL_AND_VOTE":
      return <RevealAndVotePhase state={state} />;
    case "PODIUM":
      return <PodiumPhase state={state} />;
    case "LOBBY":
      return <div className="p-8 text-center text-violet-300">Esperando al anfitrión para iniciar...</div>;
    default:
      return null;
  }
}
