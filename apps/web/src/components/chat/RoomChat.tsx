"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { api } from "@/lib/game/roomClient";
import type { GameState, RoomMessageRow } from "@silhouette/shared-types";
import { AvatarRenderer } from "../avatar/AvatarRenderer";

interface RoomChatProps {
  roomId: string | null;
  state: GameState | null;
  refresh: () => void;
}

/** Chat en tiempo real de la sala (Fase 4): mensajes + realtime. */
export function RoomChat({ roomId, state, refresh }: RoomChatProps) {
  const [messages, setMessages] = useState<RoomMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!roomId) return;
    const data = await api.getRoomState(roomId);
    if (data) setMessages(data.messages);
  };

  useEffect(() => {
    if (!roomId) return;
    void load();
    const channel = getSupabaseClient().channel(`chat:${roomId}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, () => {
        void load();
      })
      .subscribe();
    const poll = setInterval(() => void load(), 3000);
    return () => {
      clearInterval(poll);
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const send = async () => {
    if (!roomId || !input.trim() || sending) return;
    setSending(true);
    try {
      await api.sendMessage(roomId, input.trim());
      setInput("");
      void refresh();
      await load();
    } catch {
      /* el error se muestra en la API */
    } finally {
      setSending(false);
    }
  };

  const author = (userId: string | null) =>
    state?.players.find((p) => p.user_id === userId) ?? null;

  return (
    <div className="flex flex-col w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-4">
      <h3 className="font-semibold text-violet-200 mb-3">Chat de sala</h3>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[260px] mb-3">
        {messages.length === 0 && <p className="text-xs text-violet-300">Sin mensajes aún.</p>}
        {messages.map((m) => {
          const me = author(m.user_id);
          return (
            <div key={m.id} className="flex items-start gap-2 text-sm">
              {me ? <AvatarRenderer config={me.avatar_config} size={20} /> : null}
              <div>
                <span className="font-semibold text-violet-200">{me?.username ?? "(sin nombre)"}</span>{" "}
                <span className="text-xs text-violet-400">{new Date(m.created_at).toLocaleTimeString()}</span>
                {m.is_system ? (
                  <p className="italic text-xs text-violet-300 mt-0.5">{m.content}</p>
                ) : (
                  <p className="mt-0.5">{m.content}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Escribe un mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={280}
        />
        <button className="btn-primary" onClick={() => void send()} disabled={sending}>
          Enviar
        </button>
      </div>
    </div>
  );
}
