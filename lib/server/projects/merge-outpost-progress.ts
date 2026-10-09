import type { Prisma } from "@prisma/client";

/** Move the former expansion stages into Sheltered Retreat, preserving saved item IDs. */
export async function mergeOutpostProgress(tx: Prisma.TransactionClient) {
  const legacy = await tx.project.findUnique({
    where: { slug: "outpost" },
    include: { stages: { include: { items: { include: { userProgress: true } } } } },
  });
  if (!legacy) return;
  const outpost = await tx.project.upsert({
    where: { slug: "sheltered_retreat_project" },
    update: {},
    create: { slug: "sheltered_retreat_project", name: "Outpost" },
  });

  for (const stage of legacy.stages) {
    const sortOrder = stage.sortOrder + 2;
    const existing = await tx.projectStage.findUnique({
      where: { projectId_sortOrder: { projectId: outpost.id, sortOrder } },
    });
    if (!existing) {
      await tx.projectStage.update({
        where: { id: stage.id },
        data: { projectId: outpost.id, sortOrder },
      });
      continue;
    }
    // If both versions exist, retain the larger recorded quantity rather than adding it twice.
    for (const item of stage.items) {
      const target = await tx.projectItem.upsert({
        where: { stageId_itemName: { stageId: existing.id, itemName: item.itemName } },
        update: {},
        create: { stageId: existing.id, itemName: item.itemName, quantityRequired: item.quantityRequired },
      });
      for (const progress of item.userProgress) {
        const where = { userId_projectItemId: { userId: progress.userId, projectItemId: target.id } };
        const saved = await tx.userProjectItem.findUnique({ where });
        await tx.userProjectItem.upsert({
          where,
          create: { userId: progress.userId, projectItemId: target.id, quantityOwned: progress.quantityOwned },
          update: { quantityOwned: Math.max(saved?.quantityOwned ?? 0, progress.quantityOwned) },
        });
      }
    }
  }
  await tx.project.deleteMany({ where: { id: legacy.id } });
}
