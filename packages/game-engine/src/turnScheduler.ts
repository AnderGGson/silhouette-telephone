import { CHAIN_COUNT, MAX_PLAYERS, MIN_PLAYERS } from "@silhouette/shared-types";

export type ChainIndex = 0 | 1 | 2;

export interface ScheduledAssignment {
  chainIndex: ChainIndex;
  stepNumber: number;
  assignedPlayerId: string;
}

const CHAINS: ChainIndex[] = [0, 1, 2];

/**
 * Resuelve cuántos pasos tendrá cada cadena, respetando el rango 3-6 configurado
 * por el host. Con exactamente 2 jugadores se fuerza un mínimo de 4 pasos para
 * que la rotación 2-1 alternada produzca evolución visual suficiente.
 */
export function resolveMaxChainSteps(
  maxChainStepsSetting: number,
  playerCount: number,
): number {
  const clamped = Math.min(6, Math.max(3, maxChainStepsSetting));
  if (playerCount === MIN_PLAYERS) {
    return Math.max(4, clamped);
  }
  return clamped;
}

function validatePlayers(playerIds: string[]): void {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(
      `El número de jugadores debe estar entre ${MIN_PLAYERS} y ${MAX_PLAYERS}, recibido ${playerIds.length}`,
    );
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("playerIds contiene identificadores duplicados");
  }
}

/**
 * Caso N = 2 jugadores: las 3 cadenas se reparten 2-1 de forma alternada en
 * cada paso, y cada cadena alterna de jugador en cada paso (nunca repite
 * jugador en pasos consecutivos de la misma cadena).
 *
 * Construcción: chainStart = [p0, p0, p1] asigna 2 cadenas a p0 y 1 a p1 en el
 * paso 1; en pasos pares se invierte el jugador de cada cadena.
 */
function scheduleTwoPlayers(
  playerIds: [string, string],
  totalSteps: number,
): ScheduledAssignment[] {
  const [p0, p1] = playerIds;
  const chainStart: Record<ChainIndex, string> = { 0: p0, 1: p0, 2: p1 };
  const assignments: ScheduledAssignment[] = [];

  for (let step = 1; step <= totalSteps; step++) {
    const flip = step % 2 === 0;
    for (const chainIndex of CHAINS) {
      const starter = chainStart[chainIndex];
      const other = starter === p0 ? p1 : p0;
      assignments.push({
        chainIndex,
        stepNumber: step,
        assignedPlayerId: flip ? other : starter,
      });
    }
  }
  return assignments;
}

/**
 * Caso 3 <= N <= 8 jugadores.
 *
 * Paso 1: 3 jugadores distintos, uno por cadena, en orden de asiento.
 * Pasos siguientes: cada cadena elige, entre quienes aún no han participado en
 * ella, al jugador con menor carga de turnos asignados en la ronda actual
 * (para equilibrar el esfuerzo entre cadenas). Si ya participaron todos los
 * jugadores en esa cadena (S > N), se reutiliza evitando repetir al jugador
 * del paso inmediatamente anterior de esa misma cadena.
 */
function scheduleThreeToEightPlayers(
  playerIds: string[],
  totalSteps: number,
): ScheduledAssignment[] {
  const assignments: ScheduledAssignment[] = [];
  const usedInChain: Record<ChainIndex, string[]> = { 0: [], 1: [], 2: [] };
  const playerOrderIndex = new Map(playerIds.map((id, idx) => [id, idx]));

  for (let step = 1; step <= totalSteps; step++) {
    const roundLoad = new Map<string, number>();

    for (const chainIndex of CHAINS) {
      const history = usedInChain[chainIndex];
      const prevPlayer = history[history.length - 1] ?? null;

      let candidates = playerIds.filter((p) => !history.includes(p));
      if (candidates.length === 0) {
        // Todos ya participaron en esta cadena: reutilizar sin repetir al anterior.
        candidates = playerIds.filter((p) => p !== prevPlayer);
        if (candidates.length === 0) candidates = [...playerIds];
      }

      candidates.sort((a, b) => {
        const loadDiff = (roundLoad.get(a) ?? 0) - (roundLoad.get(b) ?? 0);
        if (loadDiff !== 0) return loadDiff;
        return (
          (playerOrderIndex.get(a) ?? 0) - (playerOrderIndex.get(b) ?? 0)
        );
      });

      const chosen = candidates[0] ?? playerIds[0];
      if (chosen === undefined) continue;
      history.push(chosen);
      roundLoad.set(chosen, (roundLoad.get(chosen) ?? 0) + 1);
      assignments.push({ chainIndex, stepNumber: step, assignedPlayerId: chosen });
    }
  }

  return assignments;
}

/**
 * Genera el calendario completo de asignaciones jugador-cadena-paso para toda
 * la partida. Función pura y determinista: mismo input -> mismo output.
 *
 * `playerIds` debe mantenerse en un orden estable entre llamadas (p.ej. por
 * `seat_index`) para que el resultado sea reproducible.
 */
export function scheduleParallelChains(
  playerIds: string[],
  totalSteps: number,
): ScheduledAssignment[] {
  validatePlayers(playerIds);
  if (totalSteps < 1) {
    throw new Error("totalSteps debe ser >= 1");
  }

  if (playerIds.length === MIN_PLAYERS) {
    const first = playerIds[0] ?? "";
    const second = playerIds[1] ?? "";
    return scheduleTwoPlayers([first, second], totalSteps);
  }
  return scheduleThreeToEightPlayers(playerIds, totalSteps);
}

/** Extrae solo las asignaciones de un paso específico, para persistir en `chain_assignments`. */
export function assignmentsForStep(
  schedule: ScheduledAssignment[],
  stepNumber: number,
): ScheduledAssignment[] {
  const stepAssignments = schedule.filter((a) => a.stepNumber === stepNumber);
  if (stepAssignments.length !== CHAIN_COUNT) {
    throw new Error(
      `Se esperaban ${CHAIN_COUNT} asignaciones para el paso ${stepNumber}, se encontraron ${stepAssignments.length}`,
    );
  }
  return stepAssignments;
}
