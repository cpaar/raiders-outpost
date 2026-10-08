import { expect, test, type Page } from "@playwright/test";
import type { ProjectProgressPayload } from "../types/projects";
import { getLocalIdentity, login } from "./helpers";
import { stripBlueprintLabel, stripFurnitureDesignLabel } from "../lib/item-labels";

test("collection names keep meaningful words while removing plan markers", () => {
  for (const [label, expected] of [
    ["Entwurf: Robuster Laborstuhl", "Robuster Laborstuhl"],
    ["Alpiner Kleiderschrank-Entwurf", "Alpiner Kleiderschrank"],
    ["Archiv-Stehlampe Entwurf", "Archiv-Stehlampe"],
    ["Kronleuchterentwurf", "Kronleuchter"],
    ["Stehlampenentwurf", "Stehlampen"],
    ["Grüner geometrischer Stuhlentwurf", "Grüner geometrischer Stuhl"],
    ["Sturdy Lab Cabinet (Wide) Design", "Sturdy Lab Cabinet (Wide)"],
    [" Design: Floor Lamp ", "Floor Lamp"],
    ["Floor Lamp – DESIGN", "Floor Lamp"],
    ["Designer Chair", "Designer Chair"],
    ["Redesign", "Redesign"],
    ["Entwurfszeichnung", "Entwurfszeichnung"],
    ["Waffen-Display", "Waffen-Display"],
  ]) {
    expect(stripFurnitureDesignLabel(label)).toBe(expected);
  }
  expect(stripBlueprintLabel("Bauplan: Enterhaken")).toBe("Enterhaken");
  expect(stripBlueprintLabel("Grappling Hook Blueprint")).toBe("Grappling Hook");
});

const waitForCollectionImages = async (page: Page) => {
  const images = page.locator("[data-item-id] img");
  // Load off-screen tiles too so the full collection capture verifies every asset.
  await images.evaluateAll((elements) => elements.forEach((element) => {
    (element as HTMLImageElement).loading = "eager";
  }));
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0;
  })), { timeout: 15_000 }).toBe(true);
};

test("learned blueprints, furniture and stencils persist with separate tabs and filters", async ({ page }) => {
  await login(page, "CollectionPilot");
  await page.evaluate(() => localStorage.setItem("arc:locale", "de"));
  const { token } = await getLocalIdentity(page);
  if (!token) throw new Error("Missing identity");
  const headers = { "x-arc-token": token };
  const response = await page.request.get("/api/projects?locale=de", { headers });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as ProjectProgressPayload;
  const furniture = payload.projects.find((p) => p.slug === "furniture_designs")!;
  const stencils = payload.projects.find((p) => p.slug === "weapon_stencils")!;
  const blueprint = payload.projects.find((p) => p.slug === "blueprints")!.stages[0].items.find((i) => i.itemId === "grappling_hook_blueprint")!;
  expect(furniture.stages[0].items).toHaveLength(100);
  expect(stencils.stages[0].items).toHaveLength(14);
  for (const project of [furniture, stencils]) {
    expect(project.kind).toBe("collection");
    for (const item of project.stages[0].items) {
      expect(item.quantityRequired).toBe(1);
      expect(item.displayName).not.toBe(item.itemId);
      expect(item.imageFile).toBeTruthy();
    }
  }
  const reset = await page.request.patch("/api/projects", { headers, data: {
    updates: [...furniture.stages[0].items, ...stencils.stages[0].items].map((item) => ({ projectItemId: item.projectItemId, quantityOwned: 0 })),
  } });
  expect(reset.ok()).toBeTruthy();
  expect((await page.request.patch("/api/projects", { headers, data: {
    updates: [{ projectItemId: blueprint.projectItemId, quantityOwned: 1 }],
  } })).ok()).toBeTruthy();
  await page.goto("/blueprints");
  await expect(page.getByRole("link", { name: "MetaForge", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-item-id="grappling_hook_blueprint"]')).toHaveAttribute("data-quantity", "1");
  await page.getByTestId("collection-tab-furniture_designs").click();
  await expect(page.getByTestId("collection-count-furniture_designs")).toHaveText("0 / 100");
  await expect(page.locator('[data-item-id="grappling_hook_blueprint"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="bulwark"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="alpine_wardrobe_design"] img')).toBeVisible();
  for (const [itemId, label] of [
    ["alpine_wardrobe_design", "Alpiner Kleiderschrank"],
    ["sturdy_lab_chair_design", "Robuster Laborstuhl"],
    ["archive_floor_lamp_design", "Archiv-Stehlampe"],
    ["chandelier_design", "Kronleuchter"],
    ["sturdy_lab_cabinet_wide_design", "Robuster Laborschrank (breit)"],
  ]) {
    await expect(page.locator(`[data-item-id="${itemId}"] [title]`)).toHaveAttribute("title", label);
  }
  const furnitureNames = furniture.stages[0].items.map((item) => item.displayName);
  expect(furnitureNames.every((name) => !/entwurf|\sdesign$/i.test(name))).toBe(true);
  expect(furnitureNames).toEqual([...furnitureNames].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })));
  await expect(page.getByRole("link", { name: "MetaForge", exact: true })).toHaveAttribute("href", "https://metaforge.app/arc-raiders");
  const alpine = furniture.stages[0].items.find((item) => item.itemId === "alpine_wardrobe_design")!;
  expect(alpine.imageFile).toBe("alpine_wardrobe_design_metaforge.png");
  const image = await page.request.get(`/api/arc-items/image?file=${alpine.imageFile}`);
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toBe("image/png");
  await waitForCollectionImages(page);
  await page.getByRole("main").screenshot({ path: "test-results/collection-furniture.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/collection-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId("collection-search-toggle").click();
  await page.getByTestId("collection-search").fill("Alpiner");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  const design = page.locator('[data-item-id="alpine_wardrobe_design"]');
  const saveDesign = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await design.getByTestId("qty-plus").click();
  expect((await saveDesign).ok()).toBeTruthy();
  await expect(page.getByTestId("collection-count-furniture_designs")).toHaveText("1 / 100");
  await page.getByTestId("collection-needed-filter").click();
  await expect(design).toHaveCount(0);

  await page.getByTestId("collection-tab-weapon_stencils").click();
  await expect(page.getByTestId("collection-needed-filter")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-item-id]")).toHaveCount(14);
  expect(stencils.stages[0].items.find((item) => item.itemId === "slipstream")!.imageFile).toBe("slipstream_metaforge.png");
  expect(stencils.stages[0].items.find((item) => item.itemId === "bulwark")!.imageFile).toBe("bulwark.png");
  await expect(page.getByRole("link", { name: "MetaForge", exact: true })).toBeVisible();
  await waitForCollectionImages(page);
  await page.getByRole("main").screenshot({ path: "test-results/collection-stencils.png" });
  await page.getByTestId("collection-search-toggle").click();
  await page.getByTestId("collection-search").fill("Bollwerk");
  const stencil = page.locator('[data-item-id="bulwark"]');
  const saveStencil = page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "PATCH");
  await stencil.getByTestId("qty-plus").click();
  expect((await saveStencil).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("collection-tab-weapon_stencils")).toHaveAttribute("aria-selected", "true");
  await expect(stencil).toHaveAttribute("data-quantity", "1");
  await page.getByTestId("collection-tab-furniture_designs").click();
  await expect(page.getByTestId("collection-needed-filter")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("collection-search-toggle").click();
  await expect(page.getByTestId("collection-search")).toHaveValue("Alpiner");
  await page.getByTestId("collection-needed-filter").click();
  await expect(design).toHaveAttribute("data-quantity", "1");
  await page.getByTestId("collection-tab-blueprints").click();
  await expect(page.locator('[data-item-id="grappling_hook_blueprint"]')).toHaveAttribute("data-quantity", "1");
  await page.evaluate(() => localStorage.setItem("arc:locale", "en"));
  await page.reload();
  await page.getByTestId("collection-tab-furniture_designs").click();
  await page.getByTestId("collection-search-toggle").click();
  await page.getByTestId("collection-search").fill("Alpine Wardrobe");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(design.locator("[title]")).toHaveAttribute("title", "Alpine Wardrobe");
  await expect(design).toHaveAttribute("data-quantity", "1");
});
