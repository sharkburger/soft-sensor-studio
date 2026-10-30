import { circuitKinds } from "../models/circuit";
export function validateCircuit(value: unknown, existingIds: Set<string>) {
  const fail = () => {
    throw Error("Invalid soft circuit design.");
  };
  if (!value || typeof value !== "object") return fail();
  const c = value as Record<string, any>;
  const str = (v: unknown, max = 2000) =>
    typeof v === "string" && v.length <= max;
  const integer = (v: unknown, min = -100000) =>
    Number.isSafeInteger(v) &&
    (v as number) >= min &&
    Math.abs(v as number) <= 100000;
  if (
    c.version !== 1 ||
    !c.intent ||
    !["bodyLocation", "measurement", "goal"].every((k) => str(c.intent[k])) ||
    !str(c.assumptions, 10000) ||
    !str(c.validationNotes, 10000) ||
    !Array.isArray(c.elements) ||
    !Array.isArray(c.pins) || c.pins.length > 1000 ||
    !Array.isArray(c.nets) || c.nets.length > 500 ||
    c.elements.length > 200
  )
    fail();
  const ids = new Set(existingIds);
  let totalPoints = 0;
  for (const e of c.elements) {
    if (
      !e ||
      !str(e.id, 100) ||
      !e.id ||
      ids.has(e.id) ||
      !circuitKinds.includes(e.kind) ||
      (e.textileLayer !== undefined && !["surface", "integrated", "inner"].includes(e.textileLayer)) ||
      (e.sensorId !== undefined && (!str(e.sensorId, 100) || !existingIds.has(e.sensorId))) ||
      (e.knitStructureId !== undefined && !str(e.knitStructureId, 100)) ||
      (e.sensorTemplateVersion !== undefined && ![1, 2, 3].includes(e.sensorTemplateVersion)) ||
      !["name", "materialId", "channel", "notes"].every((k) => str(e[k])) ||
      !["column", "row"].every((k) => integer(e[k])) ||
      !["width", "height"].every((k) => integer(e[k], 1)) ||
      !Array.isArray(e.points) ||
      e.points.length > 64
    )
      fail();
    ids.add(e.id);
    totalPoints += e.points.length;
    if (e.kind === "trace" && e.points.length < 2) fail();
    if (e.kind !== "trace" && e.points.length) fail();
    for (const q of e.points)
      if (!q || !integer(q.column) || !integer(q.row)) fail();
    for (const k of ["fromId", "toId"])
      if (e[k] !== undefined && !str(e[k], 100)) fail();
  }
  const netIds = new Set<string>();
  for (const net of c.nets) {
    if (!net || !str(net.id, 100) || !net.id || netIds.has(net.id) ||
        !str(net.name, 200) || !net.name || !str(net.notes, 2000)) fail();
    netIds.add(net.id);
  }
  const pinIds = new Set<string>();
  for (const pin of c.pins) {
    if (!pin || !str(pin.id, 100) || !pin.id || pinIds.has(pin.id) ||
        !str(pin.elementId, 100) || !str(pin.name, 100) || !pin.name ||
        !ids.has(pin.elementId) || !pin.point || !integer(pin.point.column) || !integer(pin.point.row) ||
        (pin.netId !== undefined && (!str(pin.netId, 100) || !netIds.has(pin.netId)))) fail();
    pinIds.add(pin.id);
  }
  for (const e of c.elements) {
    if (e.netId !== undefined && (!str(e.netId, 100) || !netIds.has(e.netId))) fail();
    for (const key of ["fromPinId", "toPinId"])
      if (e[key] !== undefined && (!str(e[key], 100) || !pinIds.has(e[key]))) fail();
  }
  if (totalPoints > 2048) fail();
}
