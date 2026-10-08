import { expect, test } from "@playwright/test";
import { translateBotName } from "@/lib/arc-bot-labels";
import { loadArcBots } from "@/lib/arc-bots";
import { loadoutNeedsWeapon } from "@/lib/scripts/random-challenge";
import { pickWeightedLoadout } from "@/lib/scripts/random-loadout";
import { getScriptEligibleItems } from "@/lib/scripts/random-item";
import {
  getScriptEligibleWeapons,
  getScriptEligibleWeaponsByRarity,
  normalizeWeaponName,
  pickWeightedWeaponRarity,
} from "@/lib/scripts/random-weapon";

test("scripts page documents the available script endpoints", async ({ page }) => {
  await page.goto("/scripts");
  const scriptsUrl = new URL(page.url());
  const expectedArcCommand = `!command add !arc $(customapi ${scriptsUrl.origin}/scripts/arc)`;
  const expectedMapCommand = `!command add !map $(customapi ${scriptsUrl.origin}/scripts/map)`;
  const expectedItemCommand = `!command add !item $(customapi "${scriptsUrl.origin}/scripts/item?rarity=$(queryescape $(1|all))")`;
  const expectedLoadoutCommand = `!command add !loadout $(customapi ${scriptsUrl.origin}/scripts/loadout)`;
  const expectedWeaponCommand = `!command add !weapon $(customapi ${scriptsUrl.origin}/scripts/weapon)`;
  const expectedChallengeCommand = `!command add !challenge $(customapi ${scriptsUrl.origin}/scripts/challenge)`;

  await expect(page.getByTestId("scripts-page")).toBeVisible();
  await expect(page.getByText("Stream Endpunkte")).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/arc", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/map", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/item", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/loadout", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/weapon", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("/scripts/challenge", { exact: true })).toBeVisible();
  await expect(page.getByText(expectedArcCommand)).toBeVisible();
  await expect(page.getByText(expectedMapCommand)).toBeVisible();
  await expect(page.getByText(expectedItemCommand)).toBeVisible();
  await expect(page.getByText(expectedLoadoutCommand)).toBeVisible();
  await expect(page.getByText(expectedWeaponCommand)).toBeVisible();
  await expect(page.getByText(expectedChallengeCommand)).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-arc")).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-map")).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-item")).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-loadout")).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-weapon")).toBeVisible();
  await expect(page.getByTestId("copy-command--scripts-challenge")).toBeVisible();

  await page.getByTestId("scripts-page").screenshot({
    path: "test-results/scripts-page.png",
  });
});

test("scripts page is accessible without login", async ({ page }) => {
  await page.goto("/scripts");

  await expect(page.getByTestId("scripts-page")).toBeVisible();
  await expect(page.getByTestId("onboarding-step-account")).toBeHidden();
});

test("arc script endpoint returns plain text", async ({ page }) => {
  const response = await page.request.get("/scripts/arc");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(/^(ARC: .+|Aktuell konnten die ARC-Daten nicht geladen werden\.)$/);
});

test("map script endpoint returns plain text", async ({ page }) => {
  const response = await page.request.get("/scripts/map");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text.length).toBeGreaterThan(0);
  expect(text).toMatch(
    /^(Map: .+|Aktuell konnten die Map-Daten nicht geladen werden\.)$/
  );
});

test("item script endpoint returns plain text", async ({ page }) => {
  const response = await page.request.get("/scripts/item");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(
    /^(Item: .+|Aktuell konnten die Item-Daten nicht geladen werden\.)$/
  );
});

test("item script endpoint supports rarity filtering", async ({ page }) => {
  const response = await page.request.get("/scripts/item?rarity=rare");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(/^Item: .+$/);
});

test("item script endpoint treats StreamElements fallback rarity as no filter", async ({ page }) => {
  const response = await page.request.get("/scripts/item?rarity=all");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(
    /^(Item: .+|Aktuell konnten die Item-Daten nicht geladen werden\.)$/
  );
});

test("item script endpoint treats unresolved chat placeholders as no rarity filter", async ({ page }) => {
  const response = await page.request.get("/scripts/item?rarity=$(1)");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(
    /^(Item: .+|Aktuell konnten die Item-Daten nicht geladen werden\.)$/
  );
});

test("item script endpoint lists available rarities for invalid rarity", async ({ page }) => {
  const response = await page.request.get("/scripts/item?rarity=definitely-not-real");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(
    /^Item: Keine Items fuer rarity "definitely-not-real" gefunden\. Verfuegbare Rarities: .+$/
  );
});

test("loadout script endpoint returns one of the expected plain text values", async ({
  page,
}) => {
  const response = await page.request.get("/scripts/loadout");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(/^Loadout: (free|normal|ohne waffe|naked)$/);
});

test("loadout weighting maps random values to the requested distribution", () => {
  expect(pickWeightedLoadout(0)).toBe("normal");
  expect(pickWeightedLoadout(0.54)).toBe("normal");
  expect(pickWeightedLoadout(0.55)).toBe("free");
  expect(pickWeightedLoadout(0.79)).toBe("free");
  expect(pickWeightedLoadout(0.8)).toBe("ohne waffe");
  expect(pickWeightedLoadout(0.94)).toBe("ohne waffe");
  expect(pickWeightedLoadout(0.95)).toBe("naked");
  expect(pickWeightedLoadout(0.9999)).toBe("naked");
});

test("weapon script endpoint returns a plain text weapon name without tier suffix", async ({
  page,
}) => {
  const response = await page.request.get("/scripts/weapon");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(/^(Waffe: .+|Aktuell konnten die Waffen-Daten nicht geladen werden\.)$/);
  expect(text).not.toMatch(/^Waffe: .+ (I|II|III|IV)$/);
});

test("challenge script endpoint returns the combined plain text payload", async ({
  page,
}) => {
  const response = await page.request.get("/scripts/challenge");
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toMatch(
    /^(Challenge: Map: .+ \| Loadout: normal \| Waffe: .+ \| ARC: .+ \| Item: .+|Challenge: Map: .+ \| Loadout: (free|ohne waffe|naked) \| ARC: .+ \| Item: .+|Aktuell konnten die Challenge-Daten nicht geladen werden\.)$/
  );
});

test("challenge loadout rules only require a weapon for normal", () => {
  expect(loadoutNeedsWeapon("normal")).toBeTruthy();
  expect(loadoutNeedsWeapon("free")).toBeFalsy();
  expect(loadoutNeedsWeapon("ohne waffe")).toBeFalsy();
  expect(loadoutNeedsWeapon("naked")).toBeFalsy();
});

test("item script exclusions filter non-loot categories generically", async () => {
  const items = getScriptEligibleItems([
    {
      id: "allowed",
      name: "Agave Juice",
      rarity: "Common",
      itemType: "Nature",
      foundIn: "Nature",
      imageFile: null,
    },
    {
      id: "blueprint",
      name: "Anvil Blueprint",
      rarity: "Rare",
      itemType: "Blueprint",
      foundIn: "Industrial",
      imageFile: null,
    },
    {
      id: "key",
      name: "Blue Gate Village Key",
      rarity: "Epic",
      itemType: "Key",
      foundIn: "Security",
      imageFile: null,
    },
    {
      id: "trinket",
      name: "Secret Meeting Info",
      rarity: "Rare",
      itemType: "Trinket",
      foundIn: "Residential",
      imageFile: null,
    },
    {
      id: "augment",
      name: "Combat MK. 1",
      rarity: "Common",
      itemType: "Augment",
      imageFile: null,
    },
    {
      id: "weapon",
      name: "Venator I",
      rarity: "Rare",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "mod",
      name: "Angled Grip II",
      rarity: "Rare",
      itemType: "Modification",
      imageFile: null,
    },
  ]);

  expect(items).toHaveLength(1);
  expect(items[0]?.id).toBe("allowed");
});

test("item script exclusions require foundIn in addition to existing rules", async () => {
  const items = getScriptEligibleItems([
    {
      id: "lootable",
      name: "Plastic Parts",
      rarity: "Common",
      itemType: "Resource",
      foundIn: "Commercial, Residential, Technological",
      imageFile: null,
    },
    {
      id: "crafted-only",
      name: "Snap Hook",
      rarity: "Legendary",
      itemType: "Quick Use",
      imageFile: null,
    },
    {
      id: "blank-found-in",
      name: "Mystery Scrap",
      rarity: "Common",
      itemType: "Resource",
      foundIn: "   ",
      imageFile: null,
    },
  ]);

  expect(items).toHaveLength(1);
  expect(items[0]?.id).toBe("lootable");
});

test("weapon name normalization strips tier suffixes only", () => {
  expect(normalizeWeaponName("Venator IV")).toBe("Venator");
  expect(normalizeWeaponName("Il Toro II")).toBe("Il Toro");
  expect(normalizeWeaponName("Dolabra")).toBe("Dolabra");
});

test("weapon script items are deduplicated by normalized weapon name", () => {
  const weapons = getScriptEligibleWeapons([
    {
      id: "venator_i",
      name: "Venator I",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "venator_iv",
      name: "Venator IV",
      rarity: "Legendary",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "dolabra",
      name: "Dolabra",
      rarity: "Rare",
      itemType: "Shotgun",
      imageFile: null,
    },
    {
      id: "not-a-weapon",
      name: "Agave Juice",
      rarity: "Common",
      itemType: "Nature",
      imageFile: null,
    },
  ]);

  expect(weapons).toEqual(["Dolabra", "Venator"]);
});

test("weapon script groups normalized weapon names by rarity", () => {
  const weaponsByRarity = getScriptEligibleWeaponsByRarity([
    {
      id: "venator_i",
      name: "Venator I",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "venator_ii",
      name: "Venator II",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "venator_iv",
      name: "Venator IV",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "dolabra",
      name: "Dolabra",
      rarity: "Rare",
      itemType: "Shotgun",
      imageFile: null,
    },
  ]);

  expect(weaponsByRarity.get("common")).toEqual(["Venator"]);
  expect(weaponsByRarity.get("rare")).toEqual(["Dolabra"]);
});

test("weapon script keeps one rarity per normalized base weapon", () => {
  const weaponsByRarity = getScriptEligibleWeaponsByRarity([
    {
      id: "venator_i",
      name: "Venator I",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
    {
      id: "venator_iv",
      name: "Venator IV",
      rarity: "Common",
      itemType: "Sniper Rifle",
      imageFile: null,
    },
  ]);

  expect(weaponsByRarity.get("common")).toEqual(["Venator"]);
  expect(weaponsByRarity.size).toBe(1);
});

test("weapon rarity weighting maps random values to the requested distribution", () => {
  const weaponsByRarity = new Map<string, string[]>([
    ["common", ["Venator"]],
    ["uncommon", ["Arpeggio"]],
    ["rare", ["Dolabra"]],
    ["epic", ["Jupiter"]],
    ["legendary", ["Equalizer"]],
  ]);

  expect(pickWeightedWeaponRarity(weaponsByRarity, 0)).toBe("uncommon");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.29)).toBe("uncommon");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.3)).toBe("rare");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.59)).toBe("rare");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.6)).toBe("common");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.79)).toBe("common");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.8)).toBe("epic");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.94)).toBe("epic");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.95)).toBe("legendary");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.9999)).toBe("legendary");
});

test("weapon rarity weighting rebalances when some rarities are unavailable", () => {
  const weaponsByRarity = new Map<string, string[]>([
    ["common", ["Venator"]],
    ["rare", ["Dolabra"]],
  ]);

  expect(pickWeightedWeaponRarity(weaponsByRarity, 0)).toBe("rare");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.59)).toBe("rare");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.6)).toBe("common");
  expect(pickWeightedWeaponRarity(weaponsByRarity, 0.9999)).toBe("common");
});

test("arc bot labels provide german translations", () => {
  expect(translateBotName("MATRIARCH", "de")).toBe("Matriarchin");
  expect(translateBotName("THE QUEEN", "de")).toBe("Königin");
  expect(translateBotName("SENTINEL", "de")).toBe("Wächter");
  expect(translateBotName("ARC Assessor", "de")).toBe("Prüfer");
  expect(translateBotName("Comet", "de")).toBe("Komet");
  expect(translateBotName("Turbine", "de")).toBe("Turbine");
});

test("arc bot loader includes local override entries from MetaForge list", async () => {
  const payload = await loadArcBots("de");
  const ids = new Set(payload.bots.map((bot) => bot.id));

  expect(ids.has("arc_assessor")).toBeTruthy();
  expect(ids.has("arc_comet")).toBeTruthy();
  expect(ids.has("arc_firefly")).toBeTruthy();
  expect(ids.has("arc_turbine")).toBeTruthy();
  expect(ids.has("arc_vaporizer")).toBeTruthy();
});
