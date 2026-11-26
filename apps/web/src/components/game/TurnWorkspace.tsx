"use client";

import { useMemo, useState } from "react";
import { api, type GameState } from "@/lib/game/roomClient";
import { DrawingCanvas } from "../canvas/DrawingCanvas";
import { SilhouetteViewer } from "../canvas/SilhouetteViewer";
import { TurnTimer } from "./TurnTimer";

interface TurnWorkspaceProps {
  state: GameState | null;
}

/**
 * Espacio del turno: adivinanza ("¿Qué viste?") durante GUESSING y dibujo
 * sobre la silueta de referencia durante DRAWING.
 */
export function TurnWorkspace({ state }: TurnWorkspaceProps) {
  const room = state?.room;
  const myAssignments = state?.myAssignments ?? [];
  const steps = state?.steps ?? [];

  const currentStep = useMemo(() => {
    const undrawn = myAssignments.filter((a) => !a.draw_submitted).map((a) => a.step_number);
    return undrawn.length ? Math.min(...undrawn) : null;
  }, [myAssignments]);

  const myAssignment = currentStep ? myAssignments.find((a) => a.step_number === currentStep) ?? null : null;

  const previousSilhouette = useMemo(() => {
    if (!myAssignment || currentStep === null || room?.turn_subphase !== "DRAWING") return null;
    return (
      steps
        .find((s) => s.chain_index === myAssignment.chain_index && s.step_number === currentStep - 1)
        ?.silhouette_image_path ?? null
    );
  }, [myAssignment, currentStep, steps, room?.turn_subphase]);

  const [guessText, setGuessText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ original: string; silhouette: string; hasStrokes: boolean } | null>(null);

  const submitGuess = async () => {
    if (!state || !myAssignment) return;
    setError(null);
    try {
      const res = await api.guess(state.room.id, myAssignment.chain_index, guessText.trim());
      if (!res) throw new Error("Error al enviar la adivinanza");
      setGuessText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    }
  };

  const submitDrawing = () => {
    if (!captured || !state || !myAssignment) return;
    (async () => {
      try {
        await api.draw(state.room.id, myAssignment.chain_index, captured);
        setCaptured(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al enviar");
      }
    })();
  };

  if (!room || room.status !== "PLAYING_TURN") return null;
  if (!myAssignment) return <p className="text-violet-300 p-4">Esperando asignación del turno...</p>;

  const guessing = room.turn_subphase === "GUESSING";

  return (
    <div className="flex flex-col items-center gap-5 w-full px-4">
      <TurnTimer expiresAt={room.step_ends_at} label={guessing ? "¿Qué viste?" : "Dibuja tu interpretación"} />
      <SilhouetteViewer src={previousSilhouette} className="max-w-xl" />
      {guessing ? (
        <div className="flex flex-col gap-2 w-full max-w-lg">
          <input
            className="input-field"
            placeholder="¿Qué viste? (1-80 caracteres)"
            value={guessText}
            maxLength={80}
            onChange={(e) => setGuessText(e.target.value)}
          />
          <button className="btn-primary" disabled={!guessText.trim()} onClick={() => void submitGuess()}>
            Guardar adivinanza
          </button>
        </div>
      ) : (
        <>
          <DrawingCanvas onCapture={(c) => setCaptured(c)} placeholder="Empieza a dibujar..." />
          {captured && (
            <button className="btn-primary" onClick={submitDrawing} disabled={captured.hasStrokes === false}>
              Enviar dibujo
            </button>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </>
      )}
    </div>
  );
}
