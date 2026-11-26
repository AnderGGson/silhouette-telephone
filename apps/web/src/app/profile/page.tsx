"use client";

import { useEffect, useState } from "react";
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
    </main>
  );
}
