/** Página del juego: await params (Next 15) y renderiza el orquestador cliente. */
import GameContent from "./GameContent";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GameContent code={code} />;
}
