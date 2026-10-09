export type CollectionCostMaterial = {
  itemId: string;
  displayName: string;
  imageFile: string | null;
  quantity: number;
};

export type CollectionItemCosts = {
  // Null means explicitly not researchable; absent means no verified data.
  research?: {
    points: number;
    stationLevel: number;
    materials: CollectionCostMaterial[];
  } | null;
  crafting?: {
    materials: CollectionCostMaterial[];
  };
};
