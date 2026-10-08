import { prisma } from "@/lib/prisma";
import { loadArcProjects } from "@/lib/arc-projects";
import { getArcItemLookupKeys, loadArcItems } from "@/lib/arc-items";
import { getCommunityForUser } from "@/lib/server/community";
import type { AppLocale } from "@/lib/locale";
import {
  getAvailableExpeditionSlug,
  isExpeditionProjectSlug,
  sanitizeCompletedExpeditionSlugs,
} from "@/lib/expeditions";
import { isUserToggleProject } from "@/lib/project-categories";
import { applyAdminProjectFilters, getAdminSettings } from "@/lib/server/admin-settings";
import {
  areExpeditionsPaused,
  getExpeditionResetWindow,
} from "@/lib/expedition-reset";
import { ensureProjects, normalizeSlugList } from "@/lib/server/projects/sync";

export const getProjectProgress = async (
  userId: string,
  locale: AppLocale
) => {
  const projectsPayload = await loadArcProjects(locale);
  const settings = await getAdminSettings();
  const filteredPayload = applyAdminProjectFilters(projectsPayload, settings);
  const [arcItems, projectRecords] = await Promise.all([
    loadArcItems(locale),
    ensureProjects(projectsPayload),
  ]);
  const expeditionSlugList = filteredPayload.projects
    .filter((project) => isExpeditionProjectSlug(project.slug))
    .map((project) => project.slug);
  const expeditionSlugs = new Set(expeditionSlugList);
  const activeUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeExpeditionSlug: true,
      completedExpeditionSlugs: true,
      inactiveProjectSlugs: true,
      expeditionResetDismissedCycle: true,
      expeditionResetCompletedCycle: true,
    },
  });
  const completedExpeditionSlugs = sanitizeCompletedExpeditionSlugs(
    activeUser?.completedExpeditionSlugs ?? [],
    expeditionSlugList
  );
  const activeExpeditionSlugFromUser =
    activeUser?.activeExpeditionSlug &&
    expeditionSlugs.has(activeUser.activeExpeditionSlug)
      ? activeUser.activeExpeditionSlug
      : null;
  const activeExpeditionSlug =
    activeExpeditionSlugFromUser ??
    (completedExpeditionSlugs.length
      ? getAvailableExpeditionSlug(completedExpeditionSlugs, expeditionSlugList)
      : null);
  const toggleableProjectSlugs = new Set(
    filteredPayload.projects
      .filter((project) =>
        isUserToggleProject(project, {
          availableExpeditionSlug: activeExpeditionSlug,
        })
      )
      .map((project) => project.slug)
  );
  const inactiveProjectSlugs = normalizeSlugList(
    (activeUser?.inactiveProjectSlugs ?? []).filter((slug) =>
      toggleableProjectSlugs.has(slug)
    )
  );
  const expeditionReset = getExpeditionResetWindow(projectsPayload.projects);

  const itemMetaById = new Map<string, {
    imageFile: string | null;
    rarity: string;
    itemType: string;
  }>();
  for (const item of arcItems.items) {
    const key = item.id ?? item.imageFile ?? "";
    if (!key) continue;
    for (const lookupKey of getArcItemLookupKeys(key)) {
      itemMetaById.set(lookupKey, {
        imageFile: item.imageFile,
        rarity: item.rarity,
        itemType: item.itemType,
      });
    }
  }

  const projectItemIdByStage = new Map<string, Map<string, string>>();
  const projectSlugByItemId = new Map<string, string>();
  const isExpeditionByItemId = new Map<string, boolean>();

  for (const project of projectRecords) {
    const stageMap = new Map<string, string>();
    for (const stage of project.stages) {
      for (const item of stage.items) {
        stageMap.set(`${stage.sortOrder}::${item.itemName}`, item.id);
      }
    }
    projectItemIdByStage.set(project.slug, stageMap);
  }

  const projectItemIds: string[] = [];
  for (const project of filteredPayload.projects) {
    const stageMap = projectItemIdByStage.get(project.slug) ?? new Map();
    for (const stage of project.stages) {
      for (const item of stage.items) {
        const projectItemId = stageMap.get(
          `${stage.sortOrder}::${item.itemId}`
        );
        if (!projectItemId) continue;
        projectItemIds.push(projectItemId);
        projectSlugByItemId.set(projectItemId, project.slug);
        isExpeditionByItemId.set(
          projectItemId,
          expeditionSlugs.has(project.slug)
        );
      }
    }
  }

  const progress = await prisma.userProjectItem.findMany({
    where: {
      userId,
      projectItemId: { in: projectItemIds },
    },
    select: {
      projectItemId: true,
      quantityOwned: true,
    },
  });

  const ownedByItemId = new Map(
    progress.map((entry) => [entry.projectItemId, entry.quantityOwned])
  );

  const community = await getCommunityForUser(userId);
  let memberCount = 0;
  let expeditionMemberCountsBySlug: Record<string, number> = {};
  let communityCountsByItemId: Record<string, number> = {};

  if (community) {
    memberCount = community.members.length;
    const memberIds = community.members.map((member) => member.id);
    expeditionMemberCountsBySlug = community.members.reduce<
      Record<string, number>
    >((acc, member) => {
      const slug = member.activeExpeditionSlug;
      if (slug && expeditionSlugs.has(slug)) {
        acc[slug] = (acc[slug] ?? 0) + 1;
      }
      return acc;
    }, {});
    const memberExpeditionById = new Map(
      community.members.map((member) => [
        member.id,
        member.activeExpeditionSlug ?? null,
      ])
    );

    const requiredByItemId = new Map<string, number>();
    const allowedItemIds = new Set(projectItemIds);
    for (const project of projectRecords) {
      for (const stage of project.stages) {
        for (const item of stage.items) {
          if (allowedItemIds.has(item.id)) {
            requiredByItemId.set(item.id, item.quantityRequired);
          }
        }
      }
    }

    const communityProgress = await prisma.userProjectItem.findMany({
      where: {
        userId: { in: memberIds },
        projectItemId: { in: projectItemIds },
      },
      select: {
        projectItemId: true,
        userId: true,
        quantityOwned: true,
      },
    });

    communityCountsByItemId = communityProgress.reduce<Record<string, number>>(
      (acc, entry) => {
        const required = requiredByItemId.get(entry.projectItemId) ?? 0;
        if (required <= 0 || entry.quantityOwned < required) {
          return acc;
        }
        const isExpedition = isExpeditionByItemId.get(entry.projectItemId);
        if (isExpedition) {
          const itemSlug = projectSlugByItemId.get(entry.projectItemId);
          const memberSlug = memberExpeditionById.get(entry.userId) ?? null;
          if (!itemSlug || memberSlug !== itemSlug) {
            return acc;
          }
        }
        if (required > 0) {
          acc[entry.projectItemId] = (acc[entry.projectItemId] ?? 0) + 1;
        }
        return acc;
      },
      {}
    );
  }

  const projects = filteredPayload.projects.map((project) => {
    const stageIdMap = projectItemIdByStage.get(project.slug) ?? new Map();

    return {
      ...project,
      stages: project.stages.map((stage) => {
        return {
          ...stage,
          name: stage.name,
          items: stage.items.map((item) => {
            const projectItemId =
              stageIdMap.get(`${stage.sortOrder}::${item.itemId}`) ?? "";
            const meta = itemMetaById.get(item.itemId) ?? {
              imageFile: null,
              rarity: "Unknown",
              itemType: "Unknown",
            };
            const isExpedition = expeditionSlugs.has(project.slug);
            return {
              projectItemId,
              projectSlug: project.slug,
              isExpedition,
              itemId: item.itemId,
              displayName: item.displayName,
              quantityRequired: item.quantityRequired,
              quantityOwned: ownedByItemId.get(projectItemId) ?? 0,
              imageFile: meta.imageFile ?? null,
              rarity: meta.rarity,
              itemType: item.kind === "objective" ? "Objective" : meta.itemType,
            };
          }),
        };
      }),
    };
  });

  return {
    projects,
    inactiveProjectSlugs,
    completedExpeditionSlugs,
    memberCount,
    expeditionMemberCountsBySlug,
    communityCountsByItemId,
    activeExpeditionSlug,
    expeditionsPaused: areExpeditionsPaused(),
    expeditionReset: expeditionReset && {
      ...expeditionReset,
      dismissed:
        activeUser?.expeditionResetDismissedCycle ===
        expeditionReset.cycleId,
      completed:
        activeUser?.expeditionResetCompletedCycle ===
        expeditionReset.cycleId,
      showNotice:
        expeditionReset.noticeActive &&
        Boolean(activeExpeditionSlug) &&
        activeUser?.expeditionResetDismissedCycle !==
          expeditionReset.cycleId &&
        activeUser?.expeditionResetCompletedCycle !==
          expeditionReset.cycleId,
    },
  };
};

export const updateUserInactiveProjectSlugs = async (
  userId: string,
  inactiveProjectSlugs: string[],
  locale: AppLocale = "de"
) => {
  const [projectsPayload, settings] = await Promise.all([
    loadArcProjects(locale),
    getAdminSettings(),
  ]);
  const filteredPayload = applyAdminProjectFilters(projectsPayload, settings);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeExpeditionSlug: true },
  });
  const allowedProjectSlugs = new Set(
    filteredPayload.projects
      .filter((project) =>
        isUserToggleProject(project, {
          availableExpeditionSlug: user?.activeExpeditionSlug ?? null,
        })
      )
      .map((project) => project.slug)
  );
  const sanitized = normalizeSlugList(inactiveProjectSlugs).filter((slug) =>
    allowedProjectSlugs.has(slug)
  );

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { inactiveProjectSlugs: sanitized },
    select: { inactiveProjectSlugs: true },
  });

  return normalizeSlugList(updated.inactiveProjectSlugs);
};

export const updateProjectItems = async (
  userId: string,
  updates: { projectItemId: string; quantityOwned: number }[]
) => {
  if (!updates.length) {
    return [];
  }

  const ids = updates.map((update) => update.projectItemId);
  const items = await prisma.projectItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, quantityRequired: true },
  });

  const requiredById = new Map(
    items.map((item) => [item.id, item.quantityRequired])
  );

  const operations: ReturnType<typeof prisma.userProjectItem.upsert>[] = [];
  const deletions: ReturnType<typeof prisma.userProjectItem.deleteMany>[] = [];

  for (const update of updates) {
    const required = requiredById.get(update.projectItemId);
    if (required === undefined) continue;
    const nextQuantity = Math.max(
      0,
      Math.min(update.quantityOwned, required)
    );

    if (nextQuantity === 0) {
      deletions.push(
        prisma.userProjectItem.deleteMany({
          where: { userId, projectItemId: update.projectItemId },
        })
      );
      continue;
    }

    operations.push(
      prisma.userProjectItem.upsert({
        where: {
          userId_projectItemId: {
            userId,
            projectItemId: update.projectItemId,
          },
        },
        update: { quantityOwned: nextQuantity },
        create: {
          userId,
          projectItemId: update.projectItemId,
          quantityOwned: nextQuantity,
        },
      })
    );
  }

  if (deletions.length || operations.length) {
    await prisma.$transaction([...deletions, ...operations]);
  }

  return updates.map((update) => ({
    projectItemId: update.projectItemId,
    quantityOwned: Math.max(
      0,
      Math.min(update.quantityOwned, requiredById.get(update.projectItemId) ?? 0)
    ),
  }));
};
