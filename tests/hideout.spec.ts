import { expect, test } from "@playwright/test";
import type { ProjectProgressPayload } from "../types/projects";
import { getLocalIdentity, login } from "./helpers";

test("hideout shows compact missing material totals and keeps them in sync with saved progress", async ({ page }) => {
  await login(page, "HideoutNeedsPilot");
  await page.evaluate(() => localStorage.setItem("arc:locale", "de"));
  const { token } = await getLocalIdentity(page);
  if (!token) throw new Error("Missing identity");
  const headers = { "x-arc-token": token };
  const response = await page.request.get("/api/projects?locale=de", { headers });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as ProjectProgressPayload;
  const bench = payload.projects.find((project) => project.slug === "weapon_bench");
  if (!bench) throw new Error("Missing weapon bench");
  const stages = bench.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const items = stages.flatMap((stage) => stage.items);
  const reset = await page.request.patch("/api/projects", {
    headers,
    data: { updates: items.map((item) => ({ projectItemId: item.projectItemId, quantityOwned: 0 })) },
  });
  expect(reset.ok()).toBeTruthy();

  await page.goto("/hideout");
  const needs = page.getByTestId(`hideout-needs-${bench.slug}`);
  await expect(needs).toBeVisible();
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantityRequired);
  }
  for (const [itemId, quantity] of totals) {
    await expect(needs.getByTestId(`hideout-needs-item-${itemId}`))
      .toHaveAttribute("data-missing", String(quantity));
  }
  const apricotMissing = payload.projects.find((project) => project.slug === "scrappy")
    ?.stages.flatMap((stage) => stage.items)
    .filter((entry) => entry.itemId === "apricot")
    .reduce((sum, entry) => sum + Math.max(0, entry.quantityRequired - entry.quantityOwned), 0);
  expect(apricotMissing).toBeGreaterThan(0);
  const apricot = page.getByTestId("hideout-needs-scrappy").getByTestId("hideout-needs-item-apricot");
  await expect(apricot).toHaveCount(1);
  await expect(apricot).toHaveAttribute("data-missing", String(apricotMissing));
  await page.getByRole("main").screenshot({ path: "test-results/hideout-missing-materials.png" });

  const item = stages[0].items.find((entry) => entry.quantityRequired > 1);
  if (!item) throw new Error("Missing adjustable material");
  await page.getByTestId(`project-card-link-${bench.slug}`).click();
  const tile = page.getByTestId("project-stage-columns")
    .getByTestId(`project-stage-${stages[0].stageKey}`)
    .locator(`[data-item-id="${item.itemId}"]`);
  const saved = page.waitForResponse((result) => result.url().includes("/api/projects") && result.request().method() === "PATCH");
  await tile.getByTestId("qty-plus").click();
  expect((await saved).ok()).toBeTruthy();
  await page.goto("/hideout");
  await expect(needs.getByTestId(`hideout-needs-item-${item.itemId}`))
    .toHaveAttribute("data-missing", String(totals.get(item.itemId)! - 1));
  await page.reload();
  await expect(needs.getByTestId(`hideout-needs-item-${item.itemId}`))
    .toHaveAttribute("data-missing", String(totals.get(item.itemId)! - 1));

  const completeStage = await page.request.patch("/api/projects", {
    headers,
    data: { updates: stages[0].items.map((entry) => ({ projectItemId: entry.projectItemId, quantityOwned: entry.quantityRequired })) },
  });
  expect(completeStage.ok()).toBeTruthy();
  await page.reload();
  for (const entry of stages[0].items) {
    const remaining = items.filter((other) => other.itemId === entry.itemId && !stages[0].items.includes(other))
      .reduce((sum, other) => sum + other.quantityRequired, 0);
    const material = needs.getByTestId(`hideout-needs-item-${entry.itemId}`);
    if (remaining) await expect(material).toHaveAttribute("data-missing", String(remaining));
    else await expect(material).toHaveCount(0);
  }
  await expect(needs.getByTestId(`hideout-needs-item-${stages[1].items[0].itemId}`)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId(`project-card-${bench.slug}`).screenshot({ path: "test-results/hideout-missing-materials-mobile.png" });

  const complete = await page.request.patch("/api/projects", {
    headers,
    data: { updates: items.map((entry) => ({ projectItemId: entry.projectItemId, quantityOwned: entry.quantityRequired })) },
  });
  expect(complete.ok()).toBeTruthy();
  await page.reload();
  await expect(needs).toHaveText("Fertig");
  await expect(needs.locator("li")).toHaveCount(0);
});
