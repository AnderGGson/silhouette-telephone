"use client";

import { GameOrchestrator } from "@/components/game/GameOrchestrator";
import { RoomChat } from "@/components/chat/RoomChat";
import { useRoomState } from "@/lib/game/roomClient";

interface GameContentProps {
  code: string;
}

export default function GameContent({ code }: GameContentProps) {
  const { state, refresh } = useRoomState(code);

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-violet-100">Sala {code}</h1>
        <p className="text-violet-300 text-sm">
          {state?.room.status} · {state?.players.length}/8 jugadores
        </p>
      </div>
      <GameOrchestrator code={code} />
      <RoomChat roomId={state?.room.id ?? null} state={state} refresh={refresh} />
    </main>
  );
}
