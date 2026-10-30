import { useEffect, useRef } from "react";
import type { Material } from "../models/project";
import { findStructure } from "../data/knitStructures";
import { drawKnit } from "../services/knitPatternGenerator";
import { materialAppearance } from "../services/materialAppearance";

export function MaterialSwatch({ material, structureId }: { material: Material; structureId?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const appearance = materialAppearance(material);
  useEffect(() => {
    const element = canvas.current;
    const structure = findStructure(structureId);
    if (!element || !structure) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#eeefe7";
    ctx.fillRect(0, 0, element.width, element.height);
    drawKnit(ctx, structure.id, 12, 8, 12, appearance);
  }, [structureId, appearance.color, appearance.texture]);
  return <canvas ref={canvas} className="material-swatch" width={144} height={96} aria-label={`${material.name} knit swatch preview`} />;
}
