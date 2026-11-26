"use client";

import { useEffect, useState } from "react";

interface TurnTimerProps {
  /** ISO de fin del turno (`rooms.step_ends_at`). */
  expiresAt: string | null;
  label: string;
  onExpire?: () => void;
}

/** Cuenta regresiva sincronizada con `step_ends_at` (Fase 4). */
export function TurnTimer({ expiresAt, label, onExpire }: TurnTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (remaining === 0 && onExpire) onExpire();
  }, [remaining, onExpire]);

  const fmt = (ms: number) => {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  return (
    <div className="text-center">
      <p className="text-xs text-violet-300 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-violet-100">{remaining === null ? "–" : fmt(remaining)}</p>
    </div>
  );
}
