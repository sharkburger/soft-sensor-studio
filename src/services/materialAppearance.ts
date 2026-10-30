import type { Material, YarnTexture } from "../models/project";

export function materialAppearance(material?: Partial<Material> | null): {
  color: string;
  texture: YarnTexture;
} {
  const color = material?.color && /^#[0-9a-f]{6}$/i.test(material.color)
    ? material.color
    : material?.yarnType?.toLowerCase() === "conductive"
      ? "#497b74"
      : "#a9b39b";
  const textures: YarnTexture[] = ["smooth", "heathered", "metallic", "fuzzy"];
  const texture = textures.includes(material?.texture as YarnTexture)
    ? material!.texture as YarnTexture
    : "smooth";
  return { color, texture };
}
