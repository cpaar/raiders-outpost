import { expect, test, type Page } from "@playwright/test";
import { areExpeditionsPaused } from "../lib/expedition-reset";
import { login } from "./helpers";

const isPauseRun = areExpeditionsPaused(new Date(
  process.env.EXPEDITION_RESET_NOW ?? "2026-03-02T12:00:00.000Z"
));

type ProjectsPayload = {
  projects: Array<{
    slug: string;
    kind: "workshop" | "project" | "blueprints";
    stages: Array<{
      items: Array<{
        projectItemId: string;
        quantityRequired: number;
        quantityOwned: number;
      }>;
    }>;
  }>;
  activeExpeditionSlug: string | null;
  completedExpeditionSlugs: string[];
  expeditionsPaused: boolean;
  expeditionReset: { cycleId: string; completed: boolean; noticeActive: boolean } | null;
};

const getTokenHeader = async (page: Page) => {
  const identity = await page.evaluate(() => {
    return {
      name: localStorage.getItem("arc:identity:name") ?? "",
      token: localStorage.getItem("arc:identity:token") ?? "",
    };
  });

  return {
    token: identity.token,
    name: identity.name,
  };
};

const loadProjects = async (page: Page) => {
  const headers = await getTokenHeader(page);
  const response = await page.request.get("/api/projects?locale=en", {
    headers: {
      "x-arc-token": headers.token,
      "x-arc-name": headers.name,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to load projects: ${response.status()}`);
  }

  return (await response.json()) as ProjectsPayload;
};

const setCompletedExpeditions = async (
  page: Page,
  completedExpeditionSlugs: readonly string[]
) => {
  const headers = await getTokenHeader(page);
  const response = await page.request.put(
    "/api/user/expedition/progress?locale=en",
    {
      headers: {
        "x-arc-token": headers.token,
        "Content-Type": "application/json",
      },
      data: { completedExpeditionSlugs },
    }
  );

  if (!response.ok()) {
    throw new Error(`Failed to set expedition progress: ${response.status()}`);
  }
};

const setActiveExpedition = async (
  page: Page,
  expeditionSlug: "expedition_project_s1" | "expedition_project"
) => {
  const completedBySlug = {
    expedition_project_s1: [],
    expedition_project: ["expedition_project_s1"],
  } as const;

  await setCompletedExpeditions(page, completedBySlug[expeditionSlug]);
};

test("expedition reset clears only workshop and blueprints and starts next expedition", async ({
  page,
}) => {
  await login(page, `ResetPilot-${Date.now().toString(36)}`);

  await setActiveExpedition(page, "expedition_project_s1");

  const before = await loadProjects(page);
  const workshopItem = before.projects
    .filter((project) => project.kind === "workshop")
    .flatMap((project) => project.stages)
    .flatMap((stage) => stage.items)
    .find((item) => item.quantityRequired > 0);
  const blueprintItem = before.projects
    .filter((project) => project.kind === "blueprints")
    .flatMap((project) => project.stages)
    .flatMap((stage) => stage.items)
    .find((item) => item.quantityRequired > 0);
  const projectItem = before.projects
    .filter((project) => project.kind === "project")
    .flatMap((project) => project.stages)
    .flatMap((stage) => stage.items)
    .find((item) => item.quantityRequired > 0);
  const expeditionItem = before.projects
    .find((project) => project.slug === "expedition_project_s1")
    ?.stages.flatMap((stage) => stage.items)
    .find((item) => item.quantityRequired > 0);

  if (!workshopItem || !blueprintItem || !projectItem || !expeditionItem) {
    throw new Error("Missing required fixture items for expedition reset test.");
  }

  const headers = await getTokenHeader(page);
  const patchResponse = await page.request.patch("/api/projects", {
    headers: {
      "x-arc-token": headers.token,
      "x-arc-name": headers.name,
      "Content-Type": "application/json",
    },
    data: {
      updates: [
        { projectItemId: workshopItem.projectItemId, quantityOwned: 1 },
        { projectItemId: blueprintItem.projectItemId, quantityOwned: 1 },
        { projectItemId: projectItem.projectItemId, quantityOwned: 1 },
        { projectItemId: expeditionItem.projectItemId, quantityOwned: 1 },
      ],
    },
  });
  if (!patchResponse.ok()) {
    throw new Error(`Failed to seed progress: ${patchResponse.status()}`);
  }

  await page.goto("/operator");
  await expect(page.getByTestId("operator-expedition-reset-open")).toBeVisible();
  if (isPauseRun && !before.expeditionReset?.noticeActive) {
    await expect(page.getByTestId("expedition-reset-notice")).toHaveCount(0);
  }
  await page
    .getByTestId("operator-expedition-reset-open")
    .screenshot({ path: "test-results/expedition-reset-trigger.png" });
  await page.getByTestId("operator-expedition-reset-open").click();
  await expect(page.getByTestId("expedition-reset-step-confirm")).toBeVisible();

  const resetResponse = page.waitForResponse((response) => {
    return Boolean(
      response.url().includes("/api/user/expedition/reset") &&
      response.request().method() === "POST" &&
      response.request().postData()?.includes('"mode":"reset"')
    );
  });
  await page.getByTestId("expedition-reset-confirm").click();
  const resetResult = await resetResponse;
  expect(resetResult.ok()).toBeTruthy();
  await page.waitForURL("**/", { timeout: 10_000 });
  await page.waitForLoadState("domcontentloaded");

  const after = await loadProjects(page);
  const getQuantity = (projectItemId: string) =>
    after.projects
      .flatMap((project) => project.stages)
      .flatMap((stage) => stage.items)
      .find((item) => item.projectItemId === projectItemId)?.quantityOwned;

  expect(getQuantity(workshopItem.projectItemId)).toBe(0);
  expect(getQuantity(blueprintItem.projectItemId)).toBe(0);
  expect(getQuantity(projectItem.projectItemId)).toBe(1);
  expect(getQuantity(expeditionItem.projectItemId)).toBe(1);
  expect(after.activeExpeditionSlug).toBe("expedition_project");
  await page.reload();
  expect((await loadProjects(page)).completedExpeditionSlugs).toEqual(["expedition_project_s1"]);

  if (isPauseRun) {
    expect(after.expeditionsPaused).toBe(true);
    expect(after.expeditionReset?.completed).toBe(true);
    await page.goto("/projects");
    await expect(page.getByTestId("expedition-pause-notice")).toBeVisible();
    await expect(page.getByTestId("project-card-expedition_project")).toHaveCount(0);
    await page.screenshot({ path: "test-results/expedition-pause-projects.png" });

    // A retry must not erase items collected after departure or advance again.
    await page.request.patch("/api/projects", {
      headers: { "x-arc-token": headers.token },
      data: { updates: [{ projectItemId: workshopItem.projectItemId, quantityOwned: 1 }] },
    });
    const repeated = await page.request.post("/api/user/expedition/reset", {
      headers: { "x-arc-token": headers.token },
      data: { mode: "reset", locale: "en" },
    });
    expect(repeated.status()).toBe(409);
    const unchanged = await loadProjects(page);
    expect(unchanged.completedExpeditionSlugs).toEqual(["expedition_project_s1"]);
    expect(unchanged.projects.flatMap(p => p.stages).flatMap(s => s.items)
      .find(item => item.projectItemId === workshopItem.projectItemId)?.quantityOwned).toBe(1);
    await page.goto("/operator");
    await expect(page.getByTestId("operator-expedition-reset-open")).toBeDisabled();
  }
});

test("dismiss flow keeps operator reset available", async ({ page }) => {
  await login(page, `ResetDismiss-${Date.now().toString(36)}`);
  await setActiveExpedition(page, "expedition_project");

  const headers = await getTokenHeader(page);
  const dismissResult = await page.request.post("/api/user/expedition/reset", {
    headers: {
      "x-arc-token": headers.token,
      "Content-Type": "application/json",
    },
    data: {
      mode: "dismiss",
      locale: "en",
    },
  });
  expect(dismissResult.ok()).toBeTruthy();

  await page.goto("/operator");
  await expect(page.getByTestId("operator-expedition-reset-open")).toBeVisible();
  await page.getByTestId("operator-expedition-reset-open").click();
  await expect(page.getByTestId("expedition-reset-dialog")).toBeVisible();
  await page.getByTestId("expedition-reset-close").click();
  await expect(page.getByTestId("expedition-reset-dialog")).toBeHidden();
});


test("last personal expedition can depart during the pause without inventing a successor", async ({ page }) => {
  test.skip(!isPauseRun, "Requires pause date");
  await login(page, `LastDeparture-${Date.now().toString(36)}`);
  await setCompletedExpeditions(page, [
    "expedition_project_s1", "expedition_project", "expedition_project_s3", "expedition_project_s4",
  ]);
  expect((await loadProjects(page)).activeExpeditionSlug).toBe("expedition_project_s5");
  const { token } = await getTokenHeader(page);
  const responses = await Promise.all([0, 1].map(() => page.request.post("/api/user/expedition/reset", {
    headers: { "x-arc-token": token },
    data: { mode: "reset", locale: "en" },
  })));
  expect(responses.map(r => r.status()).sort()).toEqual([200, 409]);
  const after = await loadProjects(page);
  expect(after.activeExpeditionSlug).toBeNull();
  expect(after.completedExpeditionSlugs).toHaveLength(5);
  expect(after.expeditionReset?.completed).toBe(true);
  await page.reload();
  expect((await loadProjects(page)).completedExpeditionSlugs).toEqual(after.completedExpeditionSlugs);
});
