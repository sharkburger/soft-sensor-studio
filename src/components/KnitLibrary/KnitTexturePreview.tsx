import { useEffect, useRef } from "react";
import type { KnitStructure } from "../../models/knitStructure";
import { drawKnit } from "../../services/knitPatternGenerator";

export function KnitTexturePreview({
  structure,
  color = "#73866c",
  columns = 18,
  rows = 8,
}: {
  structure: KnitStructure;
  color?: string;
  columns?: number;
  rows?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || structure.visualizationStatus === "notAvailable") return;
    const cell = 32;
    element.width = columns * cell;
    element.height = rows * cell;
    context.fillStyle = "#e7e9df";
    context.fillRect(0, 0, element.width, element.height);
    drawKnit(context, structure.id, columns, rows, cell, {
      color,
      texture: "heathered",
    });
  }, [color, columns, rows, structure]);

  if (structure.visualizationStatus === "notAvailable") {
    return <div className="knit-unavailable">No pattern supplied for this structure.</div>;
  }
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`${structure.name} stitch topology rendered as a yarn texture`}
    />
  );
}
