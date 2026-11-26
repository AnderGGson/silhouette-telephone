/** Página del lobby: await params (Next 15) y renderiza el componente cliente. */
import LobbyContent from "./LobbyContent";

export default async function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LobbyContent code={code} />;
}
