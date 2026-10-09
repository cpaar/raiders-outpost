import type { CollectionItemCosts } from "@/types/collection-costs";

export type ProjectItemProgress = {
  projectItemId: string;
  projectSlug: string;
  isExpedition: boolean;
  itemId: string;
  displayName: string;
  quantityRequired: number;
  quantityOwned: number;
  imageFile: string | null;
  rarity: string;
  itemType: string;
  costs?: CollectionItemCosts;
};

export type ProjectStageProgress = {
  stageKey: string;
  name: string;
  sortOrder: number;
  items: ProjectItemProgress[];
  prerequisite?: string;
  description?: string;
};

export type ProjectProgress = {
  slug: string;
  name: string;
  kind: "workshop" | "project" | "blueprints" | "collection";
  repeatable: boolean;
  timeLimitedUntil: string | null;
  startAt: string | null;
  endAt: string | null;
  expeditionEndAt: string | null;
  stages: ProjectStageProgress[];
};

export type ProjectProgressPayload = {
  projects: ProjectProgress[];
  inactiveProjectSlugs: string[];
  completedExpeditionSlugs: string[];
  memberCount: number;
  expeditionMemberCountsBySlug: Record<string, number>;
  communityCountsByItemId: Record<string, number>;
  activeExpeditionSlug: string | null;
  expeditionsPaused: boolean;
  expeditionReset: {
    cycleId: string;
    noticeStartIso: string;
    noticeEndIso: string;
    noticeActive: boolean;
    dismissed: boolean;
    completed: boolean;
    showNotice: boolean;
  } | null;
};
