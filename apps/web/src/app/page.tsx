"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/game/roomClient";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function HomePage() {
  const [code, setCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Crea una identidad anónima con nombre si el visitante aún no tiene sesión. */
  const ensureIdentity = async (): Promise<boolean> => {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user) return true;

    const name = guestName.trim();
    if (name.length < 2 || name.length > 24) {
      setError("Escribe tu nombre (2-24 caracteres) para jugar como invitado");
      return false;
    }

    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      setError(
        `No se pudo iniciar sesión como invitado: ${authError.message}. Activa "Anonymous Sign-Ins" en Supabase → Authentication → Providers.`,
      );
      return false;
    }

    const res = await api.updateProfile({ username: name });
    if (!res) {
      setError("Tu sesión de invitado se creó pero no se pudo guardar tu nombre");
      return false;
    }
    return true;
  };

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await ensureIdentity())) return;
      const res = await api.createRoom();
      if (res?.room.code) window.location.assign(`/lobby/${res.room.code}`);
      else setError("Error creando la sala");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creando la sala");
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Ingresa el código de sala");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!(await ensureIdentity())) return;
      const res = await api.joinRoom(trimmed);
      if (res?.room.code) window.location.assign(`/lobby/${res.room.code}`);
      else setError("Código de sala no válido o la sala no está abierta");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error uniéndose a la sala");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent text-center">
        Silhouette Telephone
      </h1>
      <p className="text-violet-300 text-center max-w-xl">
        Adivina lo que dibujó el anterior a través de siluetas borrosas. Trabaja en 3 cadenas
        paralelas, vota al final y suma puntos.
      </p>
      <div className="flex flex-col gap-4 w-full max-w-md">
        <label className="text-xs text-violet-300 flex flex-col gap-1">
          Tu nombre (juega como invitado, sin correo)
          <input
            className="input-field"
            placeholder="Ej. Pikachu"
            value={guestName}
            maxLength={24}
            onChange={(e) => setGuestName(e.target.value)}
          />
        </label>
        <button className="btn-primary" disabled={busy} onClick={() => void createRoom()}>
          Jugar como invitado / Crear sala nueva
        </button>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Código de sala (6 letras)"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void joinRoom()}
          />
          <button className="btn-primary" disabled={busy || code.trim().length !== 6} onClick={() => void joinRoom()}>
            Unirse
          </button>
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/auth" className="btn-ghost">
            Iniciar sesión / Registrarse
          </Link>
        </div>
        <p className="text-xs text-violet-400 text-center">
          Tu progreso de invitado se guarda en esta sesión. Si quieres conservarlo, vincula un correo
          desde tu perfil.
        </p>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
