import { expect, test } from "@playwright/test";
import { areExpeditionsPaused } from "../lib/expedition-reset";
import { getLocalIdentity, login } from "./helpers";

const paused = areExpeditionsPaused(new Date(
  process.env.EXPEDITION_RESET_NOW ?? "2026-03-02T12:00:00.000Z"
));

type Needs = { items: Array<{ itemId: string; totalNeeded: number }> };

test("saved expedition contributes to shared needs only while expeditions are running", async ({ page }) => {
  await login(page, `ExpeditionNeeds-${Date.now().toString(36)}`);
  const { token } = await getLocalIdentity(page);
  if (!token) throw new Error("Missing identity");
  const headers = { "x-arc-token": token };
  const selection = await page.request.put("/api/user/expedition/progress?locale=en", {
    headers, data: { completedExpeditionSlugs: [] },
  });
  expect(selection.ok()).toBeTruthy();
  const community = await page.request.post("/api/community", {
    headers, data: { name: "Expedition needs regression" },
  });
  expect(community.ok()).toBeTruthy();
  const { communityId } = await community.json() as { communityId: string };
  const profile = await page.request.get("/api/user/public-profile", { headers });
  expect(profile.ok()).toBeTruthy();
  const { slug } = await profile.json() as { slug: string };
  expect(slug).toBeTruthy();

  const getNeeds = async () => {
    const communityResponse = await page.request.get(`/api/community/needs?locale=en&hideEasy=false&communityIds=${communityId}`, { headers });
    const publicResponse = await page.request.get(`/api/public/${slug}?locale=en`);
    expect(communityResponse.ok()).toBeTruthy();
    expect(publicResponse.ok()).toBeTruthy();
    return [await communityResponse.json(), await publicResponse.json()] as Needs[];
  };
  const before = await getNeeds();
  const projectsResponse = await page.request.get("/api/projects?locale=en", { headers });
  expect(projectsResponse.ok()).toBeTruthy();
  const payload = await projectsResponse.json() as {
    activeExpeditionSlug: string;
    projects: Array<{ slug: string; stages: Array<{ items: Array<{
      projectItemId: string; quantityRequired: number;
    }> }> }>;
  };
  expect(payload.activeExpeditionSlug).toBe("expedition_project_s1");
  const expeditionItems = payload.projects.find(project => project.slug === payload.activeExpeditionSlug)
    ?.stages.flatMap(stage => stage.items) ?? [];
  expect(expeditionItems.length).toBeGreaterThan(0);
  const update = await page.request.patch("/api/projects", {
    headers, data: { updates: expeditionItems.map(item => ({
      projectItemId: item.projectItemId, quantityOwned: item.quantityRequired,
    })) },
  });
  expect(update.ok()).toBeTruthy();
  await page.reload();
  const after = await getNeeds();
  const totals = (needs: Needs) => needs.items.reduce((sum, item) => sum + item.totalNeeded, 0);
  for (let index = 0; index < before.length; index += 1) {
    expect(totals(before[index])).toBeGreaterThan(0);
    expect(totals(before[index]) - totals(after[index])).toBe(paused ? 0 :
      expeditionItems.reduce((sum, item) => sum + item.quantityRequired, 0));
  }
  if (paused) {
    await page.goto("/projects");
    await expect(page.getByTestId("expedition-pause-notice")).toBeVisible();
    await expect(page.getByTestId("project-card-expedition_project_s1")).toHaveCount(0);
    await page.screenshot({ path: "test-results/expedition-paused-needs.png" });
  }
});
