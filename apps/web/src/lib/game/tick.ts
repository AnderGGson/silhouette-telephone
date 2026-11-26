import { getAdminClient } from "@/lib/supabase/admin";
import {
  assignmentsForStep,
  resolveMaxChainSteps,
  scheduleParallelChains,
  tallyVotesForChain,
} from "@silhouette/game-engine";
import { VOTE_CATEGORIES } from "@silhouette/shared-types";
import type {
  ChainAssignmentRow,
  ChainStepRow,
  RoomRow,
  RoomPlayerRow,
  VoteCategory,
  VoteRow,
} from "@silhouette/shared-types";

const nowMs = () => Date.now();
const toIso = (ms: number) => new Date(ms).toISOString();
const isExpired = (stepEndsAt: string | null | undefined) =>
  stepEndsAt === null || stepEndsAt === undefined || nowMs() >= new Date(stepEndsAt).getTime();

function roomSettings(room: RoomRow) {
  return {
    ...(room.settings ?? {}),
    maxChainSteps: room.settings?.maxChainSteps ?? room.max_steps,
  } as RoomRow["settings"];
}

async function fetchPlayers(roomId: string): Promise<RoomPlayerRow[]> {
  const { data } = await getAdminClient()
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });
  return (data ?? []) as RoomPlayerRow[];
}

async function fetchAssignments(roomId: string, roundNumber: number): Promise<ChainAssignmentRow[]> {
  const { data } = await getAdminClient()
    .from("chain_assignments")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .order("chain_index", { ascending: true })
    .order("step_number", { ascending: true });
  return (data ?? []) as ChainAssignmentRow[];
}

async function fetchChainSteps(
  roomId: string,
  roundNumber: number,
  chainIndex: number,
): Promise<ChainStepRow[]> {
  const { data } = await getAdminClient()
    .from("chain_steps")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .eq("chain_index", chainIndex)
    .order("step_number", { ascending: true });
  return (data ?? []) as ChainStepRow[];
}

async function fetchVotes(
  roomId: string,
  roundNumber: number,
  chainIndex: number,
): Promise<VoteRow[]> {
  const { data } = await getAdminClient()
    .from("votes")
    .select("id, voter_id, target_step_id, category")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .eq("chain_index", chainIndex);
  return (data ?? []) as VoteRow[];
}

/** Autocompleta conceptos faltantes desde `default_concept_bank` para cada jugador. */
async function autocompleteConcepts(
  room: RoomRow,
  players: RoomPlayerRow[],
  conceptsPerPlayer: number,
) {
  const { data: allConcepts } = await getAdminClient()
    .from("concepts")
    .select("author_id, text")
    .eq("room_id", room.id)
    .eq("round_number", room.round_number);
  const existing = new Set(
    (allConcepts ?? []).map((c) => `${c.author_id ?? ""}:${c.text.toLowerCase()}`),
  );

  for (const player of players) {
    if ((allConcepts ?? []).filter((c) => c.author_id === player.user_id).length >= conceptsPerPlayer) {
      continue;
    }
    const { data: bank } = await getAdminClient()
      .from("default_concept_bank")
      .select("text")
      .limit(conceptsPerPlayer + 5);
    for (const row of bank ?? []) {
      if ((allConcepts ?? []).filter((c) => c.author_id === player.user_id).length >= conceptsPerPlayer) break;
      const key = `${player.user_id}:${row.text.toLowerCase()}`;
      if (existing.has(key)) continue;
      const { error } = await getAdminClient().from("concepts").insert({
        room_id: room.id,
        round_number: room.round_number,
        author_id: player.user_id,
        text: row.text,
      });
      if (!error) existing.add(key);
    }
  }
}

/** True si todos los jugadores tienen suficientes conceptos en esta ronda. */
async function everyoneHasConcepts(
  room: RoomRow,
  players: RoomPlayerRow[],
  conceptsPerPlayer: number,
): Promise<boolean> {
  for (const player of players) {
    const { count } = await getAdminClient()
      .from("concepts")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("round_number", room.round_number)
      .eq("author_id", player.user_id);
    if (count !== null && count < conceptsPerPlayer) return false;
  }
  return true;
}

async function selectPool(room: RoomRow) {
  const { data } = await getAdminClient()
    .from("concepts")
    .select("id, text")
    .eq("room_id", room.id)
    .eq("round_number", room.round_number)
    .eq("is_selected", false)
    .order("created_at", { ascending: true })
    .limit(6);
  return (data ?? []) as { id: string; text: string }[];
}

/** Inserta un concepto del banco por defecto; devuelve el id del nuevo concepto. */
async function insertConceptFromBank(room: RoomRow, text: string): Promise<string | null> {
  await getAdminClient().from("concepts").insert({
    room_id: room.id,
    round_number: room.round_number,
    text,
  });
  const { data } = await getAdminClient()
    .from("concepts")
    .select("id")
    .eq("room_id", room.id)
    .eq("round_number", room.round_number)
    .eq("text", text)
    .eq("is_selected", false)
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Sorteo de 3 conceptos: marca `is_selected` y asigna `chain_index` 0..2,
 * crea las asignaciones del paso 1 en paralelo y pasa a `PLAYING_TURN` en
 * modo DRAWING.
 */
async function advanceConceptSubmission(
  room: RoomRow,
  players: RoomPlayerRow[],
  settings: RoomRow["settings"],
) {
  const conceptsPerPlayer = settings.conceptsPerPlayer ?? 2;

  await autocompleteConcepts(room, players, conceptsPerPlayer);
  const allSubmitted = await everyoneHasConcepts(room, players, conceptsPerPlayer);
  if (!allSubmitted && !isExpired(room.step_ends_at)) {
    return { ok: true as const, ticked: false, message: "conceptos_incompletos" };
  }

  // Sorteo: aseguramos al menos 3 conceptos disponibles.
  let pool = await selectPool(room);
  while (pool.length < 3) {
    const { data: bank } = await getAdminClient().from("default_concept_bank").select("text").limit(6);
    const available = (bank ?? []).find(
      (b) => !pool.some((p) => p.text.toLowerCase() === b.text.toLowerCase()),
    );
    if (!available) break;
    const id = await insertConceptFromBank(room, available.text);
    if (!id) break;
    pool = [...pool, { id, text: available.text }];
  }
  if (pool.length < 3) {
    return { ok: true as const, ticked: false, message: "sin_conceptos_suficientes" };
  }

  const selected = pool.slice(0, 3);
  const chainIndexById = new Map(selected.map((c, i) => [c.id, i]));
  for (const [i, concept] of selected.entries()) {
    await getAdminClient()
      .from("concepts")
      .update({ is_selected: true, chain_index: i as 0 | 1 | 2 })
      .eq("id", concept.id);
  }

  // Asignaciones del paso 1 en paralelo (jugadores ordenados por seat_index).
  const playerIds = players.map((p) => p.user_id);
  const totalSteps = resolveMaxChainSteps(settings.maxChainSteps ?? 4, playerIds.length);
  const schedule = scheduleParallelChains(playerIds, totalSteps);
  const step1: {
    room_id: string;
    round_number: number;
    chain_index: 0 | 1 | 2;
    concept_id: string;
    step_number: number;
    assigned_user_id: string;
  }[] = [];
  for (const a of assignmentsForStep(schedule, 1)) {
    const concept = selected[a.chainIndex];
    if (!concept) continue;
    step1.push({
      room_id: room.id,
      round_number: room.round_number,
      chain_index: a.chainIndex,
      concept_id: concept.id,
      step_number: 1,
      assigned_user_id: a.assignedPlayerId,
    });
  }
  if (step1.length > 0) await getAdminClient().from("chain_assignments").insert(step1);

  await getAdminClient()
    .from("rooms")
    .update({
      status: "PLAYING_TURN",
      turn_subphase: "DRAWING",
      step_ends_at: toIso(nowMs() + (settings.drawSeconds ?? 50) * 1000),
    })
    .eq("id", room.id);

  return { ok: true as const, ticked: true, message: "turno_1_dibujo_activo" };
}

function countVotesForSteps(
  votes: VoteRow[],
  stepId: string,
): Record<VoteCategory, number> {
  const tally: Record<VoteCategory, number> = { faithful: 0, funny: 0, plot_twist: 0 };
  for (const v of votes) {
    if (v.target_step_id === stepId) tally[v.category] = (tally[v.category] ?? 0) + 1;
  }
  return tally;
}

async function currentStepOf(assignments: ChainAssignmentRow[]): Promise<number | null> {
  if (assignments.length === 0) return null;
  const undrawn = assignments.filter((a) => !a.draw_submitted).map((a) => a.step_number);
  if (undrawn.length > 0) return Math.min(...undrawn);
  return Math.max(...assignments.map((a) => a.step_number));
}

async function advancePlayingTurn(
  room: RoomRow,
  players: RoomPlayerRow[],
  settings: RoomRow["settings"],
) {
  const assignments = await fetchAssignments(room.id, room.round_number);
  if (assignments.length === 0) {
    return { ok: true as const, ticked: false, message: "sin_asignaciones" };
  }

  const currentStep = await currentStepOf(assignments);
  if (currentStep === null) {
    return { ok: true as const, ticked: false, message: "sin_asignaciones" };
  }

  const currentRows = assignments.filter((a) => a.step_number === currentStep);
  const allGuessed = currentRows.every((a) => a.guess_submitted);
  const allDrawn = currentRows.every((a) => a.draw_submitted);
  const expired = isExpired(room.step_ends_at);

  if (room.turn_subphase === "GUESSING") {
    if (!allGuessed && !expired) return { ok: true as const, ticked: false };
    await getAdminClient()
      .from("rooms")
      .update({ turn_subphase: "DRAWING", step_ends_at: toIso(nowMs() + (settings.drawSeconds ?? 50) * 1000) })
      .eq("id", room.id);
    return { ok: true as const, ticked: true, message: "dibujo_activo" };
  }

  // turn_subphase === "DRAWING"
  if (!allDrawn && !expired) return { ok: true as const, ticked: false };

  const totalSteps = resolveMaxChainSteps(settings.maxChainSteps ?? 4, players.length);
  const nextStep = currentStep + 1;

  if (nextStep <= totalSteps) {
    const conceptIdByChain = new Map<number, string>();
    for (const a of assignments) {
      if (!conceptIdByChain.has(a.chain_index)) conceptIdByChain.set(a.chain_index, a.concept_id);
    }
    const schedule = scheduleParallelChains(players.map((p) => p.user_id), totalSteps);
    const nextAssignments = assignmentsForStep(schedule, nextStep)
      .map((a) => ({
        room_id: room.id,
        round_number: room.round_number,
        chain_index: a.chainIndex,
        concept_id: conceptIdByChain.get(a.chainIndex),
        step_number: nextStep,
        assigned_user_id: a.assignedPlayerId,
      }))
      .filter((a) => a.concept_id !== undefined);
    if (nextAssignments.length > 0) {
      await getAdminClient().from("chain_assignments").insert(nextAssignments);
      const nextSubphase = nextStep > 1 ? "GUESSING" : "DRAWING";
      const stepMs =
        nextSubphase === "GUESSING"
          ? (settings.guessSeconds ?? 10) * 1000
          : (settings.drawSeconds ?? 50) * 1000;
      await getAdminClient()
        .from("rooms")
        .update({ turn_subphase: nextSubphase, step_ends_at: toIso(nowMs() + stepMs) })
        .eq("id", room.id);
      return {
        ok: true as const,
        ticked: true,
        message: nextSubphase === "GUESSING" ? "adivinanza_activo" : "dibujo_activo",
      };
    }
  }

  await getAdminClient()
    .from("rooms")
    .update({ status: "REVEAL_AND_VOTE", active_reveal_chain: 0, step_ends_at: toIso(nowMs() + 60000) })
    .eq("id", room.id);
  return { ok: true as const, ticked: true, message: "reveal_iniciado" };
}

/** Añade los puntos de votos ganadores a los pasos de una cadena. */
async function settleChainVotes(room: RoomRow, chainIndex: number) {
  const steps = await fetchChainSteps(room.id, room.round_number, chainIndex);
  if (steps.length === 0) return;
  const votes = await fetchVotes(room.id, room.round_number, chainIndex);
  const tally = steps.map((s) => ({
    stepId: s.id,
    playerId: s.player_id,
    votesByCategory: countVotesForSteps(votes, s.id),
  }));
  const winners = tallyVotesForChain(VOTE_CATEGORIES, tally);
  const awardByStep = new Map<string, number>();
  for (const w of winners) {
    for (const id of w.winningStepIds) {
      awardByStep.set(id, (awardByStep.get(id) ?? 0) + w.pointsEach);
    }
  }
  for (const [stepId, points] of awardByStep) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) continue;
    await getAdminClient()
      .from("chain_steps")
      .update({ vote_points: (step.vote_points ?? 0) + points })
      .eq("id", stepId);
  }
}

/** Suma los puntos acumulados de una cadena (automáticos + votos) a los jugadores. */
async function updatePlayerChainPoints(room: RoomRow, chainIndex: number) {
  const steps = await fetchChainSteps(room.id, room.round_number, chainIndex);
  for (const step of steps) {
    const { data } = await getAdminClient()
      .from("room_players")
      .select("id, score")
      .eq("room_id", room.id)
      .eq("user_id", step.player_id)
      .single();
    if (data) {
      const total = (step.auto_points ?? 0) + (step.vote_points ?? 0);
      if (total > 0) {
        await getAdminClient()
          .from("room_players")
          .update({ score: (data.score ?? 0) + total })
          .eq("id", data.id);
      }
    }
  }
}

async function advanceReveal(room: RoomRow) {
  if (!isExpired(room.step_ends_at)) return { ok: true as const, ticked: false };
  const chain = room.active_reveal_chain;

  if (chain < 2) {
    await settleChainVotes(room, chain);
    await updatePlayerChainPoints(room, chain);
    await getAdminClient().from("rooms").update({ active_reveal_chain: chain + 1 }).eq("id", room.id);
    return { ok: true as const, ticked: true, message: `revelo_cadena_${chain + 1}` };
  }

  // Última cadena: consolidamos y pasamos al podio.
  await settleChainVotes(room, 2);
  await updatePlayerChainPoints(room, 2);

  const players = await getAdminClient()
    .from("room_players")
    .select("user_id, score")
    .eq("room_id", room.id)
    .then((r) => r.data ?? []);
  for (const p of players) {
    const { data: profRow } = await getAdminClient()
      .from("profiles")
      .select("id, total_points, games_played")
      .eq("id", p.user_id)
      .single();
    if (profRow) {
      await getAdminClient()
        .from("profiles")
        .update({
          total_points: profRow.total_points + (p.score ?? 0),
          games_played: profRow.games_played + 1,
        })
        .eq("id", profRow.id);
    }
  }

  await getAdminClient().from("rooms").update({ status: "PODIUM", step_ends_at: null }).eq("id", room.id);
  return { ok: true as const, ticked: true, message: "podium" };
}

/** Idempotente: avanza la máquina de estados de una sala cuando procede. */
export async function tickRoom(roomId: string) {
  const { data: room } = await getAdminClient().from("rooms").select("*").eq("id", roomId).single();
  if (!room) {
    return { ok: false as const, error: "sala_no_encontrada" };
  }
  const roomRow = room as RoomRow;
  const players = await fetchPlayers(roomId);
  const settings = roomSettings(roomRow);

  if (roomRow.status === "CONCEPT_SUBMISSION") {
    return await advanceConceptSubmission(roomRow, players, settings);
  }
  if (roomRow.status === "PLAYING_TURN") {
    return await advancePlayingTurn(roomRow, players, settings);
  }
  if (roomRow.status === "REVEAL_AND_VOTE") {
    return await advanceReveal(roomRow);
  }
  return { ok: true as const, ticked: false, message: "estado_sin_accion" };
}
