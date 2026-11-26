"use client";

import { useState } from "react";
import { api, type GameState } from "@/lib/game/roomClient";
import type { AvatarConfig } from "@silhouette/shared-types";
import { AvatarRenderer } from "../avatar/AvatarRenderer";

interface ConceptSubmissionPhaseProps {
  state: GameState | null;
  onSubmitted?: () => void;
}

/**
 * Fase 1 de `CONCEPT_SUBMISSION`: cada jugador envía sus conceptos
 * (2 por defecto, máx. `conceptsPerPlayer`) durante `conceptSubmissionSeconds`.
 */
export function ConceptSubmissionPhase({ state, onSubmitted }: ConceptSubmissionPhaseProps) {
  const roomId = state?.room.id ?? null;
  const conceptsPerPlayer = state?.room.settings.conceptsPerPlayer ?? 2;
  const [values, setValues] = useState<string[]>(new Array(conceptsPerPlayer).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!roomId) return;
    setError(null);
    const concepts = values.map((v) => v.trim()).filter((v) => v.length > 0);
    if (concepts.length === 0) {
      setError("Debes enviar al menos un concepto");
      return;
    }
    setSending(true);
    try {
      const res = await api.submitConcepts(roomId, concepts);
      if (!res) throw new Error("Error al enviar");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg px-4">
      <h2 className="text-2xl font-bold text-violet-100">Envía tus conceptos</h2>
      <p className="text-violet-300 text-sm">
        Prepara hasta {conceptsPerPlayer} conceptos; el servidor autocompleta si no llegas a tiempo.
      </p>
      {(values.length > 0 ? values : Array.from({ length: conceptsPerPlayer }, () => "")).map((value, i) => (
        <input
          key={i}
          className="input-field"
          value={value}
          placeholder={`Concepto ${i + 1} (2-60 caracteres)`}
          maxLength={60}
          onChange={(e) => {
            const next = values.slice();
            next[i] = e.target.value;
            setValues(next);
          }}
        />
      ))}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button className="btn-primary" disabled={sending} onClick={() => void submit()}>
        Enviar conceptos
      </button>
    </div>
  );
}

// Referencia de tipos para futuros usos de avatar en fases de juego.
export type { AvatarConfig };
export type { GameState };
