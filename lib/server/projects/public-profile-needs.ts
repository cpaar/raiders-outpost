import { prisma } from "@/lib/prisma";
import { loadArcProjects } from "@/lib/arc-projects";
import { getArcItemLookupKeys, loadArcItems } from "@/lib/arc-items";
import type { AppLocale } from "@/lib/locale";
import { isExpeditionProjectSlug } from "@/lib/expeditions";
import { filterPausedExpeditionProjects } from "@/lib/expedition-reset";
import { applyAdminProjectFilters, getAdminSettings } from "@/lib/server/admin-settings";
import { ensureProjects } from "@/lib/server/projects/sync";
import type {
  CommunityNeedsItem,
  PublicProfileNeedsPayload,
} from "@/lib/server/projects/types";

export const getPublicProfileNeeds = async (
  userId: string,
  locale: AppLocale
): Promise<PublicProfileNeedsPayload | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      activeExpeditionSlug: true,
    },
  });

  if (!user) {
    return null;
  }

  const projectsPayload = await loadArcProjects(locale);
  const settings = await getAdminSettings();
  const filteredPayload = applyAdminProjectFilters(projectsPayload, settings);
  const [projectRecords, arcItems] = await Promise.all([
    ensureProjects(projectsPayload),
    loadArcItems(locale),
  ]);

  const itemMetaById = new Map<string, {
    itemType: string;
    rarity: string;
    imageFile: string | null;
  }>();
  for (const item of arcItems.items) {
    const key = item.id ?? item.imageFile ?? "";
    if (!key) continue;
    for (const lookupKey of getArcItemLookupKeys(key)) {
      itemMetaById.set(lookupKey, {
        itemType: item.itemType,
        rarity: item.rarity,
        imageFile: item.imageFile,
      });
    }
  }
  const expeditionSlugs = new Set(
    filteredPayload.projects
      .filter((project) => isExpeditionProjectSlug(project.slug))
      .map((project) => project.slug)
  );
  const projectItemIdByStage = new Map<string, Map<string, string>>();

  for (const project of projectRecords) {
    const stageMap = new Map<string, string>();
    for (const stage of project.stages) {
      for (const item of stage.items) {
        stageMap.set(`${stage.sortOrder}::${item.itemName}`, item.id);
      }
    }
    projectItemIdByStage.set(project.slug, stageMap);
  }

  const projectItems = filterPausedExpeditionProjects(filteredPayload.projects).flatMap((project) => {
    const stageMap = projectItemIdByStage.get(project.slug) ?? new Map();
    const isExpedition = expeditionSlugs.has(project.slug);
    return project.stages.flatMap((stage) =>
      stage.items
        .map((item) => {
          const projectItemId = stageMap.get(
            `${stage.sortOrder}::${item.itemId}`
          );
          if (!projectItemId) return null;
          const meta = itemMetaById.get(item.itemId) ?? {
            itemType: "Unknown",
            rarity: "Unknown",
            imageFile: null,
          };
          return {
            projectItemId,
            projectSlug: project.slug,
            isExpedition,
            itemId: item.itemId,
            displayName: item.displayName,
            quantityRequired: item.quantityRequired,
            itemType: meta.itemType,
            rarity: meta.rarity,
            imageFile: meta.imageFile ?? null,
          };
        })
        .filter(
          (entry): entry is {
            projectItemId: string;
            projectSlug: string;
            isExpedition: boolean;
            itemId: string;
            displayName: string;
            quantityRequired: number;
            itemType: string;
            rarity: string;
            imageFile: string | null;
          } => Boolean(entry)
        )
    );
  });

  const projectItemIds = projectItems.map((item) => item.projectItemId);
  const progress = await prisma.userProjectItem.findMany({
    where: {
      userId: user.id,
      projectItemId: { in: projectItemIds },
    },
    select: {
      projectItemId: true,
      quantityOwned: true,
    },
  });
  const ownedByItem = new Map(
    progress.map((entry) => [entry.projectItemId, entry.quantityOwned])
  );

  const itemTotals = new Map<
    string,
    {
      displayName: string;
      itemType: string;
      rarity: string;
      imageFile: string | null;
      memberNeeds: Map<string, number>;
    }
  >();

  for (const item of projectItems) {
    if (
      item.isExpedition &&
      (!user.activeExpeditionSlug || item.projectSlug !== user.activeExpeditionSlug)
    ) {
      continue;
    }
    const owned = ownedByItem.get(item.projectItemId) ?? 0;
    const needed = Math.max(0, item.quantityRequired - owned);
    if (!needed) continue;
    const entry = itemTotals.get(item.itemId) ?? {
      displayName: item.displayName,
      itemType: item.itemType,
      rarity: item.rarity,
      imageFile: item.imageFile ?? null,
      memberNeeds: new Map(),
    };
    entry.memberNeeds.set(user.id, (entry.memberNeeds.get(user.id) ?? 0) + needed);
    if (!itemTotals.has(item.itemId)) {
      itemTotals.set(item.itemId, entry);
    }
  }

  const items: CommunityNeedsItem[] = Array.from(itemTotals.entries()).map(
    ([itemId, data]) => {
      const memberNeeds = [
        {
          memberId: user.id,
          memberName: user.name,
          needed: data.memberNeeds.get(user.id) ?? 0,
        },
      ].filter((entry) => entry.needed > 0);
      const totalNeeded = memberNeeds.reduce(
        (sum, entry) => sum + entry.needed,
        0
      );
      return {
        itemId,
        displayName: data.displayName,
        itemType: data.itemType,
        rarity: data.rarity,
        imageFile: data.imageFile ?? null,
        totalNeeded,
        memberNeeds,
      };
    }
  );

  return {
    name: user.name,
    members: [
      {
        id: user.id,
        name: user.name,
        joinedAt: user.createdAt.toISOString(),
        activeExpeditionSlug: user.activeExpeditionSlug ?? null,
      },
    ],
    items,
  };
};
