/**
 * Genera la imagen silueta borrosa de un dibujo usando canvas del navegador.
 * Se usa desde `DrawingCanvas` para crear `silhouette_image_url` en Fase 3
 * (`POST /api/turns/draw`).
 */

/** Blur aplicado según el nivel de silueta configurado. */
const BLUR_PX: Record<string, number> = { soft: 8, medium: 15, extreme: 24 };

/**
 * Dibuja la imagen con un desenfoque gaussiano aproximado (`ctx.filter`)
 * y ligeros ajustes de contraste para dejar la masa y el contorno general
 * sin detalles finos, como se especificó en AGENT.MD.
 */
export async function generateSilhouette(
  image: HTMLImageElement,
  blurLevel: "soft" | "medium" | "extreme" = "medium",
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  ctx.filter = `blur(${BLUR_PX[blurLevel] ?? 15}px)`;
  ctx.globalAlpha = 0.95;
  ctx.drawImage(image, 0, 0);
  ctx.filter = "none";

  return canvas.toDataURL("image/png");
}
