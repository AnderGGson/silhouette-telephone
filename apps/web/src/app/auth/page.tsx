/** Página de auth: lee el resultado de la confirmación de correo (Next 15). */
import AuthContent from "./AuthContent";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthContent confirmed={params.confirmed === "1"} confirmError={params.error ?? null} />
  );
}
