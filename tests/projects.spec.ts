import { expect, test } from "@playwright/test";
import {
  findAdjustableTile,
  getTileQuantity,
  login,
  openProject,
} from "./helpers";

test("stages are fully expanded on first project open", async ({ page }) => {
  await login(page, "Vanguard");
  await openProject(page);

  const stages = page.locator("[data-stage-key]");
  const stageCount = await stages.count();
  expect(stageCount).toBeGreaterThan(0);

  for (let index = 0; index < stageCount; index += 1) {
    await expect(stages.nth(index)).toHaveAttribute("data-stage-expanded", "true");
  }
});

test("desktop project layout uses horizontal stage stepper", async ({ page }) => {
  await login(page, "Vanguard");
  await openProject(page);

  await expect(page.getByTestId("project-stage-stepper")).toBeVisible();
  await expect(page.getByTestId("project-stage-columns")).toBeVisible();
  await expect(page.getByTestId("project-stage-vertical-layout")).toBeHidden();
});

test("project item updates persist", async ({ page }) => {
  await login(page, "Vanguard");
  await openProject(page);
  await page.getByRole("main").screenshot({
    path: "test-results/project-detail.png",
  });

  const tile = await findAdjustableTile(page);
  if (!tile) {
    throw new Error("No adjustable tile found for persistence test.");
  }

  const itemId = await tile.getAttribute("data-item-id");
  if (!itemId) {
    throw new Error("Missing item id for adjustable tile.");
  }

  const before = await getTileQuantity(tile);
  const patchResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/projects") &&
      response.request().method() === "PATCH"
    );
  });

  await tile.getByTestId("qty-plus").click({ force: true });
  await patchResponse;

  await expect
    .poll(async () => getTileQuantity(tile))
    .toBe(before + 1);

  await page.reload();

  const tileAfter = page.locator(`[data-item-id="${itemId}"]`).first();
  await expect(tileAfter).toBeVisible();
  await expect
    .poll(async () => getTileQuantity(tileAfter))
    .toBe(before + 1);
});

test("project toggles persist per user", async ({ page }) => {
  await login(page, "TogglePilot");
  await page.goto("/projects");

  const firstToggle = page.locator('[data-testid^="project-toggle-"]').first();
  await expect(firstToggle).toBeVisible();
  const toggleTestId = await firstToggle.getAttribute("data-testid");
  const slug = toggleTestId?.replace("project-toggle-", "");
  if (!slug) {
    throw new Error("No project slug found for toggle.");
  }

  const card = page.getByTestId(`project-card-${slug}`).first();
  await expect(card).toBeVisible();
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId(`project-card-link-${slug}`)).toHaveCount(0);

  await page.reload();
  const toggleAfterReload = page.getByTestId(`project-toggle-${slug}`);
  await expect(toggleAfterReload).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId(`project-card-link-${slug}`)).toHaveCount(0);
});

test("current project is available with four stages and expired projects are hidden", async ({ page }) => {
  await login(page, "MountainPilot");
  await page.goto("/projects");
  for (const slug of ["phantom_targets_project", "phantom_targets_part_2_project"]) {
    await expect(page.getByTestId(`project-card-${slug}`)).toHaveCount(0);
  }

  const slug = "ascending_the_mountain_project";
  await expect(page.getByTestId(`project-card-${slug}`)).toBeVisible();
  await page.getByTestId(`project-card-link-${slug}`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${slug}`));
  const stages = page.getByTestId("project-stage-columns");
  await expect(stages.locator("[data-stage-key]")).toHaveCount(4);
  await expect(stages.locator('[data-item-id="mechanical_components"]')).toHaveAttribute("data-required", "10");
  await expect(stages.locator('[data-item-id="vaporizer_regulator"]')).toHaveAttribute("data-required", "3");

  for (const itemId of ["mechanical_components", "rocket_thruster", "crash_mat", "vaporizer_regulator"]) {
    const image = stages.locator(`[data-item-id="${itemId}"] img`);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByRole("main").screenshot({ path: "test-results/ascending-the-mountain.png" });
});

test("mobile project layout uses vertical stage rail", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await login(page, "MobileRailPilot");
  await openProject(page);

  await expect(page.getByTestId("project-stage-vertical-layout")).toBeVisible();
  await expect(
    page.getByTestId("project-stage-step-line-vertical").first()
  ).toBeVisible();
  await expect(page.getByTestId("project-stage-stepper")).toBeHidden();

  await context.close();
});

test("clicking a step marker toggles complete and uncomplete for a stage", async ({
  page,
}) => {
  await login(page, "StageTogglePilot");
  await openProject(page);

  const stages = page.locator("[data-stage-key]");
  const stageCount = await stages.count();
  let targetStageKey: string | null = null;

  for (let index = 0; index < stageCount; index += 1) {
    const stage = stages.nth(index);
    const stageKey = await stage.getAttribute("data-stage-key");
    if (!stageKey) continue;
    const items = stage.locator("[data-item-id]");
    const itemCount = await items.count();
    if (!itemCount) continue;

    let hasAdjustableNeeds = false;
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const item = items.nth(itemIndex);
      const required = Number((await item.getAttribute("data-required")) ?? "0");
      const owned = Number((await item.getAttribute("data-quantity")) ?? "0");
      if (required > 0 && owned < required) {
        hasAdjustableNeeds = true;
        break;
      }
    }

    if (hasAdjustableNeeds) {
      targetStageKey = stageKey;
      break;
    }
  }

  if (!targetStageKey) {
    test.skip(true, "No toggleable stage found.");
    return;
  }

  const stage = page
    .getByTestId("project-stage-columns")
    .getByTestId(`project-stage-${targetStageKey}`);
  const marker = page
    .getByTestId("project-stage-stepper")
    .getByTestId(`project-stage-step-${targetStageKey}`);

  await marker.click();
  await expect(stage).toHaveAttribute("data-stage-completed", "true");

  await marker.click();
  await expect(stage).toHaveAttribute("data-stage-completed", "false");
});
