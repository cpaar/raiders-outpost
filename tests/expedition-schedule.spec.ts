import { expect, test } from "@playwright/test";
import { areExpeditionsPaused, filterPausedExpeditionProjects, getExpeditionResetWindow } from "../lib/expedition-reset";
import overrides from "../data/arc-overrides/projects.json";
import schedule from "../data/expedition-schedule.json";

const projects = overrides.map(project => ({
  slug: project.id,
  startAt: null,
  endAt: null,
  expeditionEndAt: project.expeditionEndDate
    ? new Date(project.expeditionEndDate * 1000).toISOString()
    : null,
}));

test("paused expedition needs leave regular projects and saved expedition data intact", () => {
  const expedition = { slug: "expedition_project_s5", quantityOwned: 2 };
  const regular = { slug: "regular_project", quantityOwned: 1 };
  const saved = [expedition, regular];
  expect(filterPausedExpeditionProjects(saved, new Date("2026-10-03T12:00:00Z"))).toEqual([regular]);
  expect(saved).toEqual([expedition, regular]);
  expect(filterPausedExpeditionProjects(saved, new Date("2026-09-29T07:59:59Z"))).toEqual(saved);
});

test("departure reminder uses the September window and stops after fourteen days", () => {
  const before = getExpeditionResetWindow(projects, new Date("2026-09-27T07:59:59Z"));
  expect(before?.noticeActive).toBe(false);
  const departure = getExpeditionResetWindow(projects, new Date(schedule.departureAt));
  expect(departure?.cycleId).toBe("expedition_project_s5-2026-09-29T08:00:00.000Z");
  expect(departure?.noticeStartIso).toBe("2026-09-27T08:00:00.000Z");
  expect(departure?.noticeEndIso).toBe("2026-10-13T08:00:00.000Z");
  expect(departure?.noticeActive).toBe(true);
  const late = getExpeditionResetWindow(projects, new Date("2026-10-13T08:00:00Z"));
  expect(late?.cycleId).toBe(departure?.cycleId);
  expect(late?.noticeActive).toBe(false);
});

test("pause starts at departure and does not reopen on an invented Q1 date", () => {
  expect(areExpeditionsPaused(new Date("2026-09-29T07:59:59Z"))).toBe(false);
  expect(areExpeditionsPaused(new Date(schedule.departureAt))).toBe(true);
  expect(areExpeditionsPaused(new Date("2027-01-01T00:00:00Z"))).toBe(true);
  expect(areExpeditionsPaused(new Date("2027-04-01T00:00:00Z"))).toBe(true);
  expect(getExpeditionResetWindow(projects, new Date("2027-04-01T00:00:00Z"))?.cycleId)
    .toBe("expedition_project_s5-2026-09-29T08:00:00.000Z");
});
