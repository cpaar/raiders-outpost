import { expect, test } from "@playwright/test";
import type { ProjectProgressPayload } from "../types/projects";
import { getLocalIdentity, login } from "./helpers";
import { loadEnvConfig } from "@next/env";
import { mergeOutpostProgress } from "../lib/server/projects/merge-outpost-progress";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

test("merging Outpost projects retains existing IDs and resolves duplicate saved progress", async () => {
  loadEnvConfig(process.cwd());
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  class Rollback extends Error {}
  try {
    await expect(prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: "Outpost merge test", token: crypto.randomUUID() } });
      const legacy = await tx.project.upsert({ where: { slug: "outpost" }, update: {}, create: { slug: "outpost", name: "Legacy" } });
      const target = await tx.project.upsert({ where: { slug: "sheltered_retreat_project" }, update: {}, create: { slug: "sheltered_retreat_project", name: "Outpost" } });
      // An unused stage exercises a direct move; it and this user are rolled back after assertions.
      const movedStage = await tx.projectStage.create({ data: { projectId: legacy.id, sortOrder: 90, name: "Move" } });
      const movedItem = await tx.projectItem.create({ data: { stageId: movedStage.id, itemName: "steel_cable", quantityRequired: 3 } });
      await tx.userProjectItem.create({ data: { userId: user.id, projectItemId: movedItem.id, quantityOwned: 1 } });
      const oldStage = await tx.projectStage.upsert({ where: { projectId_sortOrder: { projectId: legacy.id, sortOrder: 2 } }, update: {}, create: { projectId: legacy.id, sortOrder: 2, name: "Room 2" } });
      const newStage = await tx.projectStage.upsert({ where: { projectId_sortOrder: { projectId: target.id, sortOrder: 4 } }, update: {}, create: { projectId: target.id, sortOrder: 4, name: "Room 2" } });
      const oldItem = await tx.projectItem.upsert({ where: { stageId_itemName: { stageId: oldStage.id, itemName: "cable_stripper" } }, update: {}, create: { stageId: oldStage.id, itemName: "cable_stripper", quantityRequired: 3 } });
      const newItem = await tx.projectItem.upsert({ where: { stageId_itemName: { stageId: newStage.id, itemName: "cable_stripper" } }, update: {}, create: { stageId: newStage.id, itemName: "cable_stripper", quantityRequired: 3 } });
      await tx.userProjectItem.createMany({ data: [
        { userId: user.id, projectItemId: oldItem.id, quantityOwned: 1 },
        { userId: user.id, projectItemId: newItem.id, quantityOwned: 2 },
      ] });
      await mergeOutpostProgress(tx);
      expect(await tx.project.findUnique({ where: { slug: "outpost" } })).toBeNull();
      expect(await tx.projectStage.findUnique({ where: { id: movedStage.id } })).toMatchObject({ projectId: target.id, sortOrder: 92 });
      expect(await tx.userProjectItem.findUnique({ where: { userId_projectItemId: { userId: user.id, projectItemId: movedItem.id } } })).toMatchObject({ quantityOwned: 1 });
      expect(await tx.userProjectItem.findUnique({ where: { userId_projectItemId: { userId: user.id, projectItemId: newItem.id } } })).toMatchObject({ quantityOwned: 2 });
      await mergeOutpostProgress(tx);
      throw new Rollback();
    })).rejects.toBeInstanceOf(Rollback);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});

test("raiders track successive Outpost expansions and keep saved material progress", async ({ page }) => {
  await login(page, "OutpostExpansionPilot");
  await page.evaluate(() => localStorage.setItem("arc:locale", "de"));
  const { token } = await getLocalIdentity(page);
  const headers = { "x-arc-token": token! };
  const response = await page.request.get("/api/projects?locale=de", { headers });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as ProjectProgressPayload;
  const outpost = payload.projects.find((project) => project.slug === "sheltered_retreat_project")!;
  expect(outpost.kind).toBe("project");
  expect(payload.projects.some((project) => project.slug === "outpost")).toBe(false);
  expect(outpost.stages).toHaveLength(6);
  const expansions = outpost.stages.slice(3);
  expect(expansions.map((stage) => stage.name)).toEqual(["Raum 2", "Raum 3", "Raum 4"]);
  expect(expansions.map((stage) => stage.items.map(({ itemId, quantityRequired }) => [itemId, quantityRequired]))).toEqual([
    [["cable_stripper", 3], ["sheetmetal", 20], ["steel_cable", 3]],
    [["epoxy_bucket", 3], ["hand_drill", 3], ["planks", 35]],
    [["insulation_roll", 3], ["laser_level", 3], ["sheetmetal", 40]],
  ]);
  for (const item of expansions.flatMap((stage) => stage.items)) {
    expect(item.displayName).not.toBe(item.itemId);
    expect(item.imageFile).toBeTruthy();
    expect((await page.request.get(`/api/arc-items/image?file=${item.imageFile}`)).ok()).toBeTruthy();
  }
  expect((await page.request.patch("/api/projects", {
    headers, data: { updates: expansions.flatMap((stage) => stage.items).map((item) => ({ projectItemId: item.projectItemId, quantityOwned: 0 })) },
  })).ok()).toBeTruthy();
  await page.goto("/hideout");
  await expect(page.getByTestId("project-card-outpost")).toHaveCount(0);
  const needs = page.getByTestId("hideout-needs-sheltered_retreat_project");
  await expect(needs.getByTestId("hideout-needs-item-sheetmetal")).toHaveAttribute("data-missing", "65");
  await page.getByTestId("project-card-link-sheltered_retreat_project").click();
  const stages = page.getByTestId("project-stage-columns");
  await expect(stages.getByTestId("project-stage-phase-6")).toContainText("Raum 4");
  const tile = stages.getByTestId("project-stage-phase-4").locator('[data-item-id="cable_stripper"]');
  const saved = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await tile.getByTestId("qty-plus").click();
  expect((await saved).ok()).toBeTruthy();
  await page.reload();
  await expect(tile).toHaveAttribute("data-quantity", "1");
  await page.getByRole("main").screenshot({ path: "test-results/outpost-expansions.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByTestId("project-stage-vertical-layout");
  await expect(mobile.getByRole("heading", { name: "Raum 2", exact: true })).toBeVisible();
  await page.getByRole("main").screenshot({ path: "test-results/outpost-expansions-mobile.png" });
  await page.goto("/hideout");
  await expect(needs.getByTestId("hideout-needs-item-cable_stripper")).toHaveAttribute("data-missing", "2");
});
