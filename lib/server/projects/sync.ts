import { prisma } from "@/lib/prisma";
import { loadArcProjects } from "@/lib/arc-projects";
import type { ProjectWithStages } from "@/lib/server/projects/types";
import { mergeOutpostProgress } from "@/lib/server/projects/merge-outpost-progress";

let projectsSeedPromise: Promise<ProjectWithStages[]> | null = null;
let projectsSeedSignature: string | null = null;

export const normalizeSlugList = (slugs: string[]) => {
  const unique = new Set(
    slugs.map((slug) => slug.trim()).filter((slug) => slug.length > 0)
  );
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
};

const buildPayloadSignature = (
  payload: Awaited<ReturnType<typeof loadArcProjects>>
) => {
  const entries: string[] = [];

  for (const project of payload.projects) {
    entries.push(`project:${project.slug}:${project.stages.length}`);
    for (const stage of project.stages) {
      entries.push(
        `stage:${project.slug}:${stage.sortOrder}:${stage.items.length}`
      );
      if (stage.items.length === 0) {
        entries.push(`stage-empty:${project.slug}:${stage.sortOrder}`);
      }
      for (const item of stage.items) {
        entries.push(
          `item:${project.slug}:${stage.sortOrder}:${item.itemId}:${item.quantityRequired}`
        );
      }
    }
  }

  return entries.sort().join("||");
};

const syncProjects = async (payload: Awaited<ReturnType<typeof loadArcProjects>>) => {
  await prisma.$transaction(async (tx) => {
    if (payload.projects.some((project) => project.slug === "sheltered_retreat_project" && project.stages.some((stage) => stage.sortOrder === 6))) {
      await mergeOutpostProgress(tx);
    }
    for (const projectData of payload.projects) {
      const project = await tx.project.upsert({
        where: { slug: projectData.slug },
        update: { name: projectData.name },
        create: {
          name: projectData.name,
          slug: projectData.slug,
        },
      });

      for (const stageData of projectData.stages) {
        const stage = await tx.projectStage.upsert({
          where: {
            projectId_sortOrder: {
              projectId: project.id,
              sortOrder: stageData.sortOrder,
            },
          },
          update: { name: stageData.name },
          create: {
            projectId: project.id,
            name: stageData.name,
            sortOrder: stageData.sortOrder,
          },
        });

        for (const itemData of stageData.items) {
          await tx.projectItem.upsert({
            where: {
              stageId_itemName: {
                stageId: stage.id,
                itemName: itemData.itemId,
              },
            },
            update: { quantityRequired: itemData.quantityRequired },
            create: {
              stageId: stage.id,
              itemName: itemData.itemId,
              quantityRequired: itemData.quantityRequired,
            },
          });
        }
      }
    }
  });
};

export const ensureProjects = async (
  payload?: Awaited<ReturnType<typeof loadArcProjects>>
) => {
  const nextPayload = payload ?? (await loadArcProjects());
  const payloadSignature = buildPayloadSignature(nextPayload);

  if (projectsSeedPromise && projectsSeedSignature === payloadSignature) {
    return projectsSeedPromise;
  }

  projectsSeedSignature = payloadSignature;
  projectsSeedPromise = (async () => {
    await syncProjects(nextPayload);
    return prisma.project.findMany({
      include: {
        stages: {
          include: { items: true },
        },
      },
    });
  })();

  return projectsSeedPromise;
};
