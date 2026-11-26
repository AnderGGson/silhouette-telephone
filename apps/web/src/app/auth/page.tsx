"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "guest">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const login = async () => {
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else router.push("/");
  };

  const register = async () => {
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signUp({ email, password });
    if (err) setError(err.message);
    else {
      if (username.trim()) {
        await getSupabaseClient().auth.updateUser({ data: { username } });
      }
      setError("Revisa tu correo para confirmar tu cuenta.");
    }
  };

  const guest = async () => {
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signInAnonymously();
    if (err) setError(err.message);
    else router.push("/");
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
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${mode === m ? "bg-violet-600 text-white" : "text-violet-300 hover:bg-white/10"}`}
          >
            {m === "login" ? "Iniciar sesión" : m === "register" ? "Registrarse" : "Invitado"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 w-full">
        {mode !== "guest" && (
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
            {mode === "register" && (
              <input
                className="input-field"
                type="text"
                placeholder="Nombre de usuario (2-24)"
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}
          </>
        )}
        <button className="btn-primary" onClick={submit}>
          {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Registrarse" : "Continuar como Invitado"}
        </button>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
