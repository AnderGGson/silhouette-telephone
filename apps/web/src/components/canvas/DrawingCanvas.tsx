"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateSilhouette } from "@/lib/canvas/silhouetteGenerator";

export interface CapturedDrawing {
  original: string;
  silhouette: string;
  hasStrokes: boolean;
}

export interface DrawingCanvasProps {
  onCapture?: (captured: CapturedDrawing) => void;
  disabled?: boolean;
  blurLevel?: "soft" | "medium" | "extreme";
  placeholder?: string;
}

type Tool = "brush" | "eraser";

interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

const SIZES = [4, 8, 16, 26] as const;
const PALETTE = [
  "#f0f0f0", "#ffffff", "#e8ff47", "#ff6b6b", "#4ecdc4", "#9b5de5",
  "#f15bb5", "#00bbf9", "#fee440", "#f3722c", "#000000", "#444",
];
const SIZE_NAMES = ["sm", "md", "lg", "xl"];

/**
 * Lienzo de dibujo HTML5 (mouse, trackpad, touch, stylus): pincel, borrador,
 * 4 tamaños, paleta, deshacer y limpiar. Usa `devicePixelRatio` para nitidez.
 */
export function DrawingCanvas({ onCapture, disabled, blurLevel = "medium", placeholder }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [sizeIndex, setSizeIndex] = useState(1);
  const [color, setColor] = useState("#e8ff47");

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      const first = stroke.points[0];
      if (first) ctx.moveTo(first.x, first.y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }, []);

  const pointFor = (event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDown = useCallback(
    (event: PointerEvent) => {
      if (disabled) return;
      activeRef.current = { tool, color, size: SIZES[sizeIndex] ?? SIZES[0], points: [pointFor(event)] };
      redraw();
    },
    [disabled, tool, color, sizeIndex, redraw],
  );

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const active = activeRef.current;
      if (!active || !canvasRef.current) return;
      const point = pointFor(event);
      active.points.push(point);
      redraw();
    },
    [redraw],
  );

  const handleUp = useCallback(() => {
    const active = activeRef.current;
    activeRef.current = null;
    if (active && active.points.length > 0) {
      strokesRef.current = [...strokesRef.current, active];
      redraw();
    }
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointermove", handleMove);
    const up = () => handleUp();
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [handleDown, handleMove, handleUp]);

  useEffect(redraw, [redraw]);

  const undo = useCallback(() => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    redraw();
  }, [redraw]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    redraw();
  }, [redraw]);

  const capture = useCallback(async (): Promise<CapturedDrawing | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const original = canvas.toDataURL("image/png");
    const hasStrokes = strokesRef.current.length > 0;
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Error cargando imagen"));
      image.src = original;
    });
    const silhouette = await generateSilhouette(image, blurLevel);
    return { original, silhouette, hasStrokes };
  }, [blurLevel]);

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      <canvas
        ref={canvasRef}
        width={480}
        height={320}
        className="w-full h-auto max-h-[60vh] bg-white rounded-2xl border-2 border-white/10 touch-none cursor-crosshair"
        style={{
          imageRendering: "pixelated",
          touchAction: "none",
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setTool("brush")} className={`px-3 py-1 rounded-lg text-sm ${tool === "brush" ? "bg-white/20 text-white" : "bg-white/5 text-violet-300 hover:bg-white/10"}`}>
          Pincel
        </button>
        <button type="button" onClick={() => setTool("eraser")} className={`px-3 py-1 rounded-lg text-sm ${tool === "eraser" ? "bg-white/20 text-white" : "bg-white/5 text-violet-300 hover:bg-white/10"}`}>
          Borrador
        </button>
        {SIZE_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => setSizeIndex(i)}
            className={`px-3 py-1 rounded-lg text-sm ${sizeIndex === i ? "bg-white/20 text-white" : "bg-white/5 text-violet-300 hover:bg-white/10"}`}
          >
            {name}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          {PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${color === hex ? "border-white scale-110" : "border-transparent"}`}
              style={{ background: hex }}
            />
          ))}
        </div>
        <button type="button" onClick={undo} className="btn-ghost">
          Deshacer
        </button>
        <button type="button" onClick={clear} className="btn-ghost">
          Limpiar
        </button>
        {onCapture && (
          <button
            type="button"
            onClick={() => {
            void capture().then((c) => {
              if (c && onCapture) onCapture(c);
            });
          }}
            disabled={disabled}
            className="btn-primary ml-auto"
          >
            Enviar dibujo
          </button>
        )}
      </div>
      {placeholder && strokesRef.current.length === 0 && (
        <p className="text-sm text-violet-300 text-center -mt-1">{placeholder}</p>
      )}
    </div>
  );
}
