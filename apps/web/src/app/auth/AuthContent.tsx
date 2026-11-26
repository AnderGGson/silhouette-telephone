"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { api } from "@/lib/game/roomClient";

interface AuthContentProps {
  confirmed: boolean;
  confirmError: string | null;
}

export default function AuthContent({ confirmed, confirmError }: AuthContentProps) {
  const [mode, setMode] = useState<"login" | "register" | "guest">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(confirmError);
  const [notice, setNotice] = useState<string | null>(
    confirmed ? "Correo confirmado. Ya puedes iniciar sesión." : null,
  );
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");

  const login = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: err } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else router.push("/");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setError(null);
    setNotice(null);
    if (username.trim().length < 2 || username.trim().length > 24) {
      setError("El nombre de usuario debe tener entre 2 y 24 caracteres");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim() },
          emailRedirectTo: `${appUrl}/auth/confirm`,
        },
      });
      if (err) setError(err.message);
      else setNotice(`Te enviamos un correo a ${email}. Sigue el enlace para confirmar tu cuenta.`);
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    setError(null);
    setNotice(null);
    if (username.trim().length < 2 || username.trim().length > 24) {
      setError("Escribe tu nombre (2-24 caracteres) para jugar como invitado");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await getSupabaseClient().auth.signInAnonymously();
      if (err) {
        setError(`${err.message}. Activa "Anonymous Sign-Ins" en Supabase → Authentication → Providers.`);
        return;
      }
      const res = await api.updateProfile({ username: username.trim() });
      if (!res) {
        setError("No se pudo guardar tu nombre de invitado");
        return;
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === "login") void login();
    else if (mode === "register") void register();
    else void guest();
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-violet-100">Accede a tu sala</h1>
      <div className="flex gap-2 bg-white/5 rounded-xl p-1">
        {(["login", "register", "guest"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${mode === m ? "bg-violet-600 text-white" : "text-violet-300 hover:bg-white/10"}`}
          >
            {m === "login" ? "Iniciar sesión" : m === "register" ? "Registrarse" : "Invitado"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 w-full">
        {mode !== "guest" ? (
          <>
            <input
              className="input-field"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Contraseña (6+ caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <p className="text-sm text-violet-300 text-center">
            Juegas sin correo. Escribe tu nombre; luego puedes vincular una cuenta desde tu perfil.
          </p>
        )}
        {(mode === "register" || mode === "guest") && (
          <input
            className="input-field"
            type="text"
            placeholder="Tu nombre (2-24 caracteres)"
            maxLength={24}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {mode === "login"
            ? "Iniciar sesión"
            : mode === "register"
              ? "Registrarse"
              : "Continuar como Invitado"}
        </button>
        {notice && <p className="text-emerald-300 text-sm text-center">{notice}</p>}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
