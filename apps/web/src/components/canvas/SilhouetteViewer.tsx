"use client";

interface SilhouetteViewerProps {
  /** dataURL de la silueta (versión borrosa) de la referencia visual. */
  src: string | null;
  className?: string;
}

/** Visor de la silueta borrosa de referencia para "¿Qué viste?" y dibujar. */
export function SilhouetteViewer({ src, className = "" }: SilhouetteViewerProps) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt="Referencia de silueta"
      className={`max-h-64 object-contain rounded-2xl border-2 border-white/10 opacity-80 ${className}`}
    />
  );
}
