"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProfileRow } from "@silhouette/shared-types";
import { DEFAULT_AVATAR_CONFIG } from "@silhouette/shared-types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { api } from "@/lib/game/roomClient";
import { AvatarCustomizer } from "@/components/avatar/AvatarCustomizer";

/** Página de perfil: personaliza avatar, nombre y muestra estadísticas. */
export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getSupabaseClient().auth.getUser();
      const userId = data?.user?.id;
      if (!userId) return;
      const { data: p } = await getSupabaseClient()
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (p) {
        setProfile(p);
        setUsername(p.username);
      }
    })();
  }, []);

  const saveUsername = async () => {
    setMsg(null);
    const res = await api.updateProfile({ username });
    if (res?.profile) {
      setProfile((p) => (p ? { ...p, username: res.profile.username } : p));
      setMsg("Nombre actualizado");
    } else {
      setMsg("Error al guardar el nombre");
    }
  };

  const saveAvatar = async (avatarConfig: ProfileRow["avatar_config"]) => {
    setProfile((p) => (p ? { ...p, avatar_config: avatarConfig } : p));
  };

  /** Convierte la cuenta de invitado en permanente conservando perfil y puntos. */
  const claimAccount = async () => {
    setLinkMsg(null);
    if (!linkEmail.includes("@") || linkPassword.length < 6) {
      setLinkMsg("Introduce un correo válido y una contraseña de 6+ caracteres");
      return;
    }
    setLinking(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({
        email: linkEmail.trim(),
        password: linkPassword,
      });
      if (error) setLinkMsg(error.message);
      else {
        setLinkMsg("¡Listo! Ya puedes iniciar sesión con este correo desde cualquier dispositivo.");
        setProfile((p) => (p ? { ...p, is_guest: false } : p));
      }
    } finally {
      setLinking(false);
    }
  };

  if (!profile) {
    return (
      <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-violet-300">Todavía no tienes perfil.</p>
        <Link href="/" className="btn-primary">
          Jugar como invitado o iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col gap-8">
      <h1 className="text-3xl font-bold text-violet-100">Mi perfil</h1>

      <AvatarCustomizer
        value={profile?.avatar_config ?? DEFAULT_AVATAR_CONFIG}
        onChange={saveAvatar}
      />

      <div className="flex flex-col gap-3 max-w-md">
        <label className="text-sm text-violet-300">Nombre de usuario</label>
        <div className="flex gap-2">
          <input className="input-field flex-1" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} />
          <button className="btn-primary" onClick={() => void saveUsername()}>Guardar</button>
        </div>
        {msg && <p className="text-sm text-violet-300">{msg}</p>}
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <dt className="text-xs text-violet-300">Puntos totales</dt>
            <dd className="text-2xl font-bold text-violet-100">{profile?.total_points ?? 0}</dd>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <dt className="text-xs text-violet-300">Partidas jugadas</dt>
            <dd className="text-2xl font-bold text-violet-100">{profile?.games_played ?? 0}</dd>
          </div>
        </dl>
      </div>

      {profile.is_guest && (
        <section className="max-w-md bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-violet-100">Guardar mi progreso</h2>
            <p className="text-xs text-violet-300">
              Estás jugando como invitado. Vincula un correo y contraseña para conservar tus puntos
              y tu avatar sin perder esta partida.
            </p>
          </div>
          <input
            className="input-field"
            type="email"
            placeholder="Correo electrónico"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
          />
          <input
            className="input-field"
            type="password"
            placeholder="Contraseña (6+ caracteres)"
            value={linkPassword}
            onChange={(e) => setLinkPassword(e.target.value)}
          />
          <button className="btn-primary self-start" disabled={linking} onClick={() => void claimAccount()}>
            {linking ? "Vinculando..." : "Vincular correo a mi cuenta"}
          </button>
          {linkMsg && <p className="text-sm text-violet-300">{linkMsg}</p>}
        </section>
      )}
    </main>
  );
}
