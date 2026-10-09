import catalog from "@/data/arc-overrides/collection-costs.json";
import type { CollectionItemCosts } from "@/types/collection-costs";
import type { ArcItem } from "@/lib/arc-items";

type MaterialSource = { itemId: string; quantity: number };
type CostSource = {
  research?: { points: number; stationLevel: number; materials: MaterialSource[] } | null;
  crafting?: { materials: MaterialSource[] };
};

const costsByItemId: Record<string, CostSource> = catalog.items;

export function getCollectionItemCosts(
  itemId: string,
  materialItems: Map<string, ArcItem>
): CollectionItemCosts | undefined {
  const source = costsByItemId[itemId];
  if (!source) return undefined;
  const resolveMaterials = (materials: MaterialSource[]) => materials.map((material) => ({
    ...material,
    displayName: materialItems.get(material.itemId)?.name ?? material.itemId,
    imageFile: materialItems.get(material.itemId)?.imageFile ?? null,
  }));
  return {
    research: source.research ? {
      ...source.research,
      materials: resolveMaterials(source.research.materials),
    } : source.research,
    crafting: source.crafting ? {
      materials: resolveMaterials(source.crafting.materials),
    } : undefined,
  };
}
