import { expect, test } from "@playwright/test";
import type { ProjectProgressPayload } from "../types/projects";
import { getLocalIdentity, login } from "./helpers";

test("raiders inspect research and furniture costs without changing learned progress", async ({ page }) => {
  await login(page, "CollectionCostsPilot");
  await page.evaluate(() => localStorage.setItem("arc:locale", "de"));
  const { token } = await getLocalIdentity(page);
  const headers = { "x-arc-token": token! };
  const response = await page.request.get("/api/projects?locale=de", { headers });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as ProjectProgressPayload;
  const blueprints = payload.projects.find((p) => p.slug === "blueprints")!.stages[0].items;
  const furniture = payload.projects.find((p) => p.slug === "furniture_designs")!.stages[0].items;
  expect(blueprints.filter((item) => item.costs?.research)).toHaveLength(59);
  expect(furniture.filter((item) => item.costs?.research)).toHaveLength(53);
  expect(furniture.filter((item) => item.costs?.crafting)).toHaveLength(100);
  for (const item of [...blueprints, ...furniture]) {
    for (const material of [...item.costs?.research?.materials ?? [], ...item.costs?.crafting?.materials ?? []]) {
      expect(material.displayName).not.toBe(material.itemId);
      expect(material.quantity).toBeGreaterThan(0);
    }
  }
  const bantam = blueprints.find((item) => item.itemId === "bantam_blueprint")!;
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/api/projects")) requests.push(request.url());
  });
  await page.goto("/blueprints");
  const bantamFooter = page.getByTestId("collection-costs-bantam_blueprint");
  await expect(bantamFooter.getByTestId("footer-research-summary")).toContainText("3.000");
  await expect(bantamFooter.getByTestId("footer-material-hornet_driver")).toContainText("8× Hornissentreiber");
  await page.getByTestId("collection-costs-bantam_blueprint").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByTestId("research-points")).toHaveText("3.000 Forschungspunkte");
  await expect(tooltip.getByTestId("research-station-level")).toHaveText("Forschungsstation Stufe 1");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tooltip.getByTestId("cost-material-hornet_driver")).toHaveAttribute("data-required", "8");
  await expect(tooltip.getByTestId("cost-material-hornet_driver")).toHaveText("8×Hornissentreiber");
  await expect(tooltip.getByTestId("collection-crafting-costs")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await bantamFooter.locator("..").screenshot({ path: "test-results/blueprint-cost-footer.png" });
  await bantamFooter.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(tooltip).toHaveCount(0);
  await expect(page.locator('[data-item-id="bantam_blueprint"]')).toHaveAttribute("data-quantity", String(bantam.quantityOwned));

  await page.getByTestId("collection-tab-furniture_designs").click();
  await page.getByTestId("collection-costs-small_lab_cabinet_design").click();
  await expect(tooltip.getByTestId("research-points")).toHaveText("500 Forschungspunkte");
  await expect(tooltip.getByTestId("collection-research-costs").getByTestId("cost-material-metal_parts")).toHaveAttribute("data-required", "15");
  const craft = tooltip.getByTestId("collection-crafting-costs");
  await expect(craft).toContainText("Herstellung pro Stück");
  await expect(craft.getByTestId("cost-material-rubber_parts")).toHaveAttribute("data-required", "4");
  await expect(craft.getByTestId("cost-material-sheetmetal")).toHaveAttribute("data-required", "8");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("collection-costs-small_lab_cabinet_design").click();
  await expect(tooltip).toBeVisible();
  await expect.poll(() => tooltip.locator("img").evaluateAll((images) =>
    images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)
  )).toBe(true);
  await page.screenshot({ path: "test-results/collection-costs-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  const cabinetFooter = page.getByTestId("collection-costs-small_lab_cabinet_design");
  await expect(cabinetFooter.getByTestId("footer-crafting-materials").getByTestId("footer-material-rubber_parts")).toContainText("4× Gummiteile");
  await cabinetFooter.locator("..").screenshot({ path: "test-results/furniture-cost-footer.png" });
  await page.screenshot({ path: "test-results/collection-cost-footers-mobile.png" });
  await page.getByTestId("collection-costs-tufted_sofa_design").click();
  await expect(tooltip.getByTestId("research-points")).toHaveText("2.000 Forschungspunkte");
  await expect(tooltip.getByTestId("collection-crafting-costs").getByTestId("cost-material-spring_cushion")).toHaveAttribute("data-required", "3");
  await page.keyboard.press("Escape");
  const pianoFooter = page.getByTestId("collection-costs-study_piano_design");
  await expect(pianoFooter.getByTestId("footer-research-summary")).toContainText("–");
  await pianoFooter.click();
  await expect(tooltip.getByTestId("collection-research-costs")).toHaveCount(0);
  await expect(tooltip.getByTestId("collection-crafting-costs")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("collection-tab-weapon_stencils").click();
  await expect(page.locator('[data-testid^="collection-costs-"]')).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.evaluate(() => {
    localStorage.setItem("arc:locale", "en");
    localStorage.setItem("arc:collection:selected", JSON.stringify("blueprints"));
  });
  await page.reload();
  await page.getByTestId("collection-costs-bantam_blueprint").click();
  await expect(tooltip.getByTestId("research-points")).toHaveText("3,000 Research Points");
  await expect(tooltip.getByTestId("cost-material-hornet_driver")).toContainText("Hornet Driver");
});
