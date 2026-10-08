export const COLLECTIONS = [
  { slug: "blueprints", itemType: "Blueprint", name: { de: "Blueprints", en: "Blueprints" } },
  { slug: "furniture_designs", itemType: "Design", name: { de: "Möbelentwürfe", en: "Furniture designs" } },
  { slug: "weapon_stencils", itemType: "Stencil", name: { de: "Waffenschablonen", en: "Weapon stencils" } },
] as const;

export type CollectionSlug = typeof COLLECTIONS[number]["slug"];

export const isCollectionSlug = (value: unknown): value is CollectionSlug =>
  COLLECTIONS.some((collection) => collection.slug === value);
