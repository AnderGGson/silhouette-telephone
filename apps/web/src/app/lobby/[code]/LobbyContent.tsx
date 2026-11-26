"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { api, useRoomState } from "@/lib/game/roomClient";
import { RoomChat } from "@/components/chat/RoomChat";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { GameState, RoomSettingsJson } from "@silhouette/shared-types";
import { DEFAULT_ROOM_SETTINGS } from "@silhouette/shared-types";
import type { User } from "@supabase/supabase-js";

interface LobbyContentProps {
  code: string;
}

export default function LobbyContent({ code }: LobbyContentProps) {
  const { state, refresh } = useRoomState(code);
  const [user, setUser] = useState<User | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettingsJson>(DEFAULT_ROOM_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getSupabaseClient().auth.getUser();
      setUser(data?.user ?? null);
    })();
  }, []);

  useEffect(() => {
    if (state?.room) setSettingsDraft({ ...DEFAULT_ROOM_SETTINGS, ...state.room.settings });
  }, [state?.room]);

  const room = state?.room;
  const isHost = user && room ? room.host_id === user.id : false;
  const me = state?.players.find((p) => p.user_id === user?.id) ?? null;

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.startRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar");
    } finally {
      setBusy(false);
    }
  }, [code]);

  const toggleReady = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = !ready;
      await api.setReady(code, next);
      setReady(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar estado");
    } finally {
      setBusy(false);
    }
  }, [code, ready]);

  const saveSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateRoomSettings(code, settingsDraft);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando ajustes");
    } finally {
      setBusy(false);
    }
  };

  if (!room) return <p className="p-6 text-violet-300">Cargando sala...</p>;

  const players = state?.players ?? [];
  const canStart = isHost && players.length >= 2 && players.length <= 8;

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-violet-100">Sala {room.code}</h1>
          <p className="text-violet-300 text-sm">
            {players.length}/8 jugadores · {room.status === "LOBBY" ? "Esperando" : room.status}
          </p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={() => window.location.assign("/")}>
            Salir de la sala
          </button>
          <button className="btn-primary" disabled={busy || !me} onClick={() => void toggleReady()}>
            {ready ? "Ya estoy listo" : "Estoy listo"}
          </button>
          {isHost && (
            <button className="btn-primary" disabled={busy || !canStart} onClick={() => void start()}>
              Iniciar partida
            </button>
          )}
        </div>
      </div>

      {/* Jugadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {players.map((p) => (
          <div
            key={p.user_id}
            className={`flex items-center gap-3 bg-white/5 border-2 rounded-2xl p-3 transition ${
              p.user_id === user?.id ? "border-violet-500" : p.is_ready ? "border-emerald-500/60" : "border-white/10"
            }`}
          >
            <AvatarRenderer config={p.avatar_config} size={40} />
            <div>
              <p className="font-semibold text-violet-100 text-sm">{p.username}</p>
              <p className="text-xs text-violet-400">
                {p.user_id === room.host_id ? "Anfitrión" : ""}
                {me && p.user_id === me.user_id && p.is_ready && " · Listo"}
                {!p.is_connected && " · Desconectado"}
              </p>
            </div>
          </div>
        ))}
        {players.length === 0 && <p className="text-violet-300">Sin jugadores aún...</p>}
      </div>

      {/* Ajustes del anfitrión */}
      {isHost && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-lg flex flex-col gap-4">
          <h2 className="font-semibold text-violet-200">Ajustes de la partida</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-violet-300 flex flex-col gap-1">
              Conceptos por jugador
              <input className="input-field" type="number" min={1} max={4} value={settingsDraft.conceptsPerPlayer} onChange={(e) => setSettingsDraft({ ...settingsDraft, conceptsPerPlayer: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-violet-300 flex flex-col gap-1">
              Segundos de envío de conceptos
              <input className="input-field" type="number" min={10} max={45} value={settingsDraft.conceptSubmissionSeconds} onChange={(e) => setSettingsDraft({ ...settingsDraft, conceptSubmissionSeconds: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-violet-300 flex flex-col gap-1">
              Segundos de adivinanza
              <input className="input-field" type="number" min={5} max={20} value={settingsDraft.guessSeconds} onChange={(e) => setSettingsDraft({ ...settingsDraft, guessSeconds: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-violet-300 flex flex-col gap-1">
              Segundos de dibujo
              <input className="input-field" type="number" min={20} max={120} value={settingsDraft.drawSeconds} onChange={(e) => setSettingsDraft({ ...settingsDraft, drawSeconds: Number(e.target.value) })} />
            </label>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy} onClick={() => void saveSettings()}>
              Guardar ajustes
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      <RoomChat roomId={room.id} state={state as GameState | null} refresh={refresh} />
    </main>
  );
}
