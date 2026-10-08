import type { ProjectStageProgress } from "@/types/projects";

type ItemProgress = {
  quantityRequired: number;
  quantityOwned: number;
};

export const getMissingProjectItems = (stages: ProjectStageProgress[]) => {
  const missingById = new Map<string, ProjectStageProgress["items"][number] & { quantityMissing: number }>();
  for (const stage of stages.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const item of stage.items) {
      if (item.itemType === "Objective") continue;
      const quantityMissing = Math.max(0, item.quantityRequired - item.quantityOwned);
      if (!quantityMissing) continue;
      const existing = missingById.get(item.itemId);
      if (existing) {
        existing.quantityMissing += quantityMissing;
      } else {
        missingById.set(item.itemId, { ...item, quantityMissing });
      }
    }
  }
  return Array.from(missingById.values());
};

export const isItemComplete = (item: ItemProgress) =>
  item.quantityRequired > 0 && item.quantityOwned >= item.quantityRequired;

export const getProgressStats = (items: ItemProgress[]) => {
  const totalCount = items.length;
  const completedCount = items.filter(isItemComplete).length;
  const isCompleted = totalCount === 0 || completedCount === totalCount;
  const progressRatio = totalCount ? completedCount / totalCount : 1;

  return {
    completedCount,
    totalCount,
    isCompleted,
    progressRatio,
  };
};
