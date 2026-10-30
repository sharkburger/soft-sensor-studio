import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useStudio } from "../stores/studio";
import { useCircuitUI, elementLayer } from "../stores/circuitUI";
import { circuitColors } from "../models/circuit";
import { patternToCylinder } from "../services/geometry";
export function Circuit3D({ offset }: { offset: number }) {
  const { project: p, select, selected } = useStudio(),
    layers = useCircuitUI((s) => s.layers);
  const elements = p.circuit?.elements ?? [];
  const meshes = useMemo(
    () =>
      elements.map((e) => {
        const layerOffset = e.textileLayer === "inner" ? -1.2 : e.textileLayer === "integrated" ? -0.5 : 0.7;
        if (e.kind === "trace") {
          const path = new THREE.CurvePath<THREE.Vector3>();
          for (let j = 1; j < e.points.length; j++) {
            const a = e.points[j - 1],
              b = e.points[j],
              steps = Math.max(
                1,
                Math.min(64, Math.ceil(Math.abs(b.column - a.column) / 2)),
              );
            for (let k = 0; k < steps; k++) {
              const q = (t: number) =>
                new THREE.Vector3(
                  ...patternToCylinder(
                    a.column + (b.column - a.column) * t,
                    a.row + (b.row - a.row) * t,
                    p.garment,
                    offset + layerOffset,
                  ),
                );
              path.add(new THREE.LineCurve3(q(k / steps), q((k + 1) / steps)));
            }
          }
          if (!path.curves.length || path.getLength() < 0.0001)
            return new THREE.BufferGeometry();
          return new THREE.TubeGeometry(
            path,
            Math.min(256, Math.max(8, path.curves.length * 3)),
            Math.min(p.garment.stitchWidthMm, p.garment.rowHeightMm) *
              e.width *
              0.5,
            6,
            false,
          );
        }
        const vertices: number[] = [],
          indices: number[] = [],
          steps = Math.min(128, Math.max(2, Math.ceil(e.width / 2)));
        for (let i = 0; i <= steps; i++)
          for (const r of [e.row, e.row + e.height])
            vertices.push(
              ...patternToCylinder(
                e.column + (e.width * i) / steps,
                r,
                p.garment,
                offset + layerOffset,
              ),
            );
        for (let i = 0; i < steps; i++) {
          const a = i * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(vertices, 3),
        );
        g.setIndex(indices);
        g.computeVertexNormals();
        return g;
      }),
    [elements, p.garment, offset],
  );
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group>
      {elements
        .filter((e) => layers[elementLayer(e.kind)])
        .map((e) => (
          <mesh
            key={e.id}
            geometry={meshes[elements.indexOf(e)]}
            onClick={(v) => {
              v.stopPropagation();
              select(e.id);
            }}
          >
            <meshStandardMaterial
              color={circuitColors[e.kind]}
              side={THREE.DoubleSide}
              roughness={0.75}
              transparent={e.kind === "insulation"}
              opacity={e.kind === "insulation" ? 0.23 : 1}
              depthWrite={e.kind !== "insulation"}
              emissive={selected === e.id ? circuitColors[e.kind] : "#000"}
              emissiveIntensity={selected === e.id ? 0.3 : 0}
            />
          </mesh>
        ))}
    </group>
  );
}
