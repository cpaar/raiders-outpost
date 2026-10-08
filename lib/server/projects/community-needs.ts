import { prisma } from "@/lib/prisma";
import { loadArcProjects } from "@/lib/arc-projects";
import { getArcItemLookupKeys, loadArcItems } from "@/lib/arc-items";
import { getCommunitiesForUser } from "@/lib/server/community";
import type { AppLocale } from "@/lib/locale";
import { isExpeditionProjectSlug } from "@/lib/expeditions";
import { filterPausedExpeditionProjects } from "@/lib/expedition-reset";
import { applyAdminProjectFilters, getAdminSettings } from "@/lib/server/admin-settings";
import { ensureProjects } from "@/lib/server/projects/sync";
import type { CommunityNeedsItem } from "@/lib/server/projects/types";

export const getCommunityNeeds = async (
  userId: string,
  locale: AppLocale,
  options?: {
    communityIds?: string[] | null;
    hideEasy?: boolean;
  }
) => {
  const allCommunities = await getCommunitiesForUser(userId);
  const requestedCommunityIds = options?.communityIds ?? null;

  const sourceCommunities = Array.isArray(requestedCommunityIds)
    ? allCommunities.filter((community) =>
        requestedCommunityIds.includes(community.id)
      )
    : allCommunities;

  if (!sourceCommunities.length) {
    return { members: [], items: [] };
  }

  const projectsPayload = await loadArcProjects(locale);
  const settings = await getAdminSettings();
  const communityPayload = applyAdminProjectFilters(projectsPayload, settings);
  const hideEasy = options?.hideEasy ?? true;
  const easyItemIds = new Set(settings.easyItemIds);
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
    communityPayload.projects
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

  const projectItems = filterPausedExpeditionProjects(communityPayload.projects).flatMap((project) => {
    const stageMap = projectItemIdByStage.get(project.slug) ?? new Map();
    const isExpedition = expeditionSlugs.has(project.slug);
    return project.stages.flatMap((stage) =>
      stage.items
        .filter((item) => item.kind !== "objective")
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

  const memberById = new Map<
    string,
    {
      id: string;
      name: string;
      joinedAt: Date;
      activeExpeditionSlug: string | null;
    }
  >();

  for (const community of sourceCommunities) {
    for (const member of community.members) {
      if (!memberById.has(member.id)) {
        memberById.set(member.id, member);
      }
    }
  }

  const members = Array.from(memberById.values());
  const memberIds = members.map((member) => member.id);
  const userProjectSettings = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, inactiveProjectSlugs: true },
  });
  const inactiveSlugsByMemberId = new Map(
    userProjectSettings.map((entry) => [
      entry.id,
      new Set(entry.inactiveProjectSlugs),
    ])
  );
  const projectItemIds = projectItems.map((item) => item.projectItemId);

  const progress = await prisma.userProjectItem.findMany({
    where: {
      userId: { in: memberIds },
      projectItemId: { in: projectItemIds },
    },
    select: {
      userId: true,
      projectItemId: true,
      quantityOwned: true,
    },
  });

  const ownedByMemberItem = new Map<string, number>();
  for (const entry of progress) {
    ownedByMemberItem.set(
      `${entry.userId}::${entry.projectItemId}`,
      entry.quantityOwned
    );
  }

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

  for (const member of members) {
    const inactiveProjectSlugs = inactiveSlugsByMemberId.get(member.id);
    const activeExpedition = expeditionSlugs.has(
      member.activeExpeditionSlug ?? ""
    )
      ? member.activeExpeditionSlug
      : null;
    for (const item of projectItems) {
      if (hideEasy && easyItemIds.has(item.itemId)) continue;
      if (inactiveProjectSlugs?.has(item.projectSlug)) continue;
      if (item.isExpedition) {
        if (!activeExpedition) continue;
        if (item.projectSlug !== activeExpedition) continue;
      }
      const owned =
        ownedByMemberItem.get(`${member.id}::${item.projectItemId}`) ?? 0;
      const needed = Math.max(0, item.quantityRequired - owned);
      if (!needed) continue;
      const entry = itemTotals.get(item.itemId) ?? {
        displayName: item.displayName,
        itemType: item.itemType,
        rarity: item.rarity,
        imageFile: item.imageFile ?? null,
        memberNeeds: new Map(),
      };
      entry.memberNeeds.set(
        member.id,
        (entry.memberNeeds.get(member.id) ?? 0) + needed
      );
      if (!itemTotals.has(item.itemId)) {
        itemTotals.set(item.itemId, entry);
      }
    }
  }

  const items: CommunityNeedsItem[] = Array.from(itemTotals.entries()).map(
    ([itemId, data]) => {
      const memberNeeds = members
        .map((member) => ({
          memberId: member.id,
          memberName: member.name,
          needed: data.memberNeeds.get(member.id) ?? 0,
        }))
        .filter((entry) => entry.needed > 0);
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
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      joinedAt: member.joinedAt.toISOString(),
      activeExpeditionSlug: member.activeExpeditionSlug ?? null,
    })),
    items,
  };
};
