import { create } from "zustand";
import type { CircuitKind, Point, TextileLayer } from "../models/circuit";
export type CircuitLayer =
  "textile" | "sensing" | "routing" | "contacts" | "insulation";
export const useCircuitUI = create<{
  enabled: boolean;
  tool: CircuitKind | "select";
  draft: Point[];
  materialId: string;
  activeLayer: TextileLayer;
  layers: Record<CircuitLayer, boolean>;
  set: (
    p: Partial<{
      enabled: boolean;
      tool: CircuitKind | "select";
      draft: Point[];
      materialId: string;
      activeLayer: TextileLayer;
      layers: Record<CircuitLayer, boolean>;
    }>,
  ) => void;
}>((set) => ({
  enabled: false,
  tool: "select",
  draft: [],
  materialId: "c-yarn",
  activeLayer: "surface",
  layers: {
    textile: true,
    sensing: true,
    routing: true,
    contacts: true,
    insulation: true,
  },
  set,
}));
export const elementLayer = (kind: CircuitKind): CircuitLayer =>
  kind === "trace"
    ? "routing"
    : kind === "sensing-region"
      ? "sensing"
      : kind === "insulation"
        ? "insulation"
        : "contacts";
