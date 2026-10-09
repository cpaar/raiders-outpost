import { expect, test } from "@playwright/test";
import type { ProjectProgressPayload } from "../types/projects";
import { getLocalIdentity, login } from "./helpers";

test("raiders track new blueprints, outpost objectives and research materials across reloads", async ({ page }) => {
  await login(page, "FrozenTrailPilot");
  await page.evaluate(() => localStorage.setItem("arc:locale", "de"));
  const { token } = await getLocalIdentity(page);
  if (!token) throw new Error("Missing identity");
  const headers = { "x-arc-token": token };
  const response = await page.request.get("/api/projects?locale=de", { headers });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as ProjectProgressPayload;
  const outpost = payload.projects.find((p) => p.slug === "sheltered_retreat_project")!;
  const research = payload.projects.find((p) => p.slug === "research_station")!;
  const blueprints = payload.projects.find((p) => p.slug === "blueprints")!;
  expect(outpost.stages).toHaveLength(6);
  expect(research.stages).toHaveLength(4);
  const newBlueprintIds = ["advanced_camera", "banjo", "bantam", "emperor_gateway_conduit", "grappling_hook", "stiletto", "tether_launcher", "yank_grenade"].map((id) => `${id}_blueprint`);
  for (const id of newBlueprintIds) {
    const item = blueprints.stages[0].items.find((entry) => entry.itemId === id)!;
    expect(item.itemType).toBe("Blueprint");
    expect(item.imageFile).toBeTruthy();
    expect((await page.request.get(`/api/arc-items/image?file=${item.imageFile}`)).ok()).toBeTruthy();
  }
  const reset = await page.request.patch("/api/projects", {
    headers,
    data: { updates: [...outpost.stages, ...research.stages, ...blueprints.stages].flatMap((s) => s.items)
      .map((item) => ({ projectItemId: item.projectItemId, quantityOwned: 0 })) },
  });
  expect(reset.ok()).toBeTruthy();

  await page.goto("/hideout");
  await expect(page.getByTestId("project-card-research_station")).toBeVisible();
  await page.getByTestId("project-card-link-sheltered_retreat_project").click();
  const columns = page.getByTestId("project-stage-columns");
  const photo = columns.getByRole("checkbox", { name: "Fotografiere ein Farmhaus mit einer Kamera." });
  await expect(photo).toHaveAttribute("aria-checked", "false");
  const savePhoto = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await photo.click();
  expect((await savePhoto).ok()).toBeTruthy();
  await page.reload();
  await expect(photo).toHaveAttribute("aria-checked", "true");
  await expect(columns.getByTestId("project-stage-phase-2").locator('[data-item-id="planks"]')).toHaveAttribute("data-required", "3");
  await page.getByRole("main").screenshot({ path: "test-results/frozen-trail-outpost.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("project-stage-vertical-layout").getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");
  await page.getByRole("main").screenshot({ path: "test-results/frozen-trail-outpost-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/hideout");
  await page.getByTestId("project-card-link-research_station").click();
  await expect(columns.getByTestId("stage-prerequisite")).toHaveCount(4);
  await expect(columns.getByTestId("stage-prerequisite").last()).toContainText("4 Außenposten-Räume");
  const planks = columns.getByTestId("project-stage-level-1").locator('[data-item-id="planks"]');
  await expect(planks).toHaveAttribute("data-required", "35");
  const saveMaterial = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await planks.getByTestId("qty-plus").click();
  expect((await saveMaterial).ok()).toBeTruthy();
  await page.reload();
  await expect(planks).toHaveAttribute("data-quantity", "1");
  await page.getByRole("main").screenshot({ path: "test-results/frozen-trail-research.png" });

  await page.goto("/blueprints");
  const blueprint = page.locator('[data-item-id="grappling_hook_blueprint"]');
  const saveBlueprint = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await blueprint.getByTestId("qty-plus").click();
  expect((await saveBlueprint).ok()).toBeTruthy();
  await page.reload();
  await expect(blueprint).toHaveAttribute("data-quantity", "1");

  const communityResponse = await page.request.post("/api/community", { headers, data: { name: "Frozen Trail materials" } });
  expect(communityResponse.ok()).toBeTruthy();
  const { communityId } = await communityResponse.json() as { communityId: string };
  const needsResponse = await page.request.get(`/api/community/needs?locale=de&hideEasy=false&communityIds=${communityId}`, { headers });
  expect(needsResponse.ok()).toBeTruthy();
  const needs = await needsResponse.json() as { items: { itemId: string; totalNeeded: number }[] };
  expect(needs.items.some((item) => item.itemId.startsWith("objective:"))).toBe(false);
  expect(needs.items.find((item) => item.itemId === "planks")?.totalNeeded).toBe(72);
  const slugResponse = await page.request.get("/api/user/public-profile", { headers });
  const { slug } = await slugResponse.json() as { slug: string };
  const publicResponse = await page.request.get(`/api/public/${slug}?locale=de`);
  expect(publicResponse.ok()).toBeTruthy();
  const publicNeeds = await publicResponse.json() as typeof needs;
  expect(publicNeeds.items.some((item) => item.itemId.startsWith("objective:"))).toBe(false);
  expect(publicNeeds.items.find((item) => item.itemId === "planks")?.totalNeeded).toBe(72);
});
