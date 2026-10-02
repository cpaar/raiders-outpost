import schedule from "@/data/expedition-schedule.json";
import { isExpeditionProjectSlug } from "@/lib/expeditions";

const EXPEDITION_RESET_NOTICE_LEAD_TIME_MS = 2 * 24 * 60 * 60 * 1000;
const EXPEDITION_RESET_NOTICE_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

type ScheduledProject = {
  slug: string;
  startAt: string | null;
  endAt: string | null;
  expeditionEndAt: string | null;
};

export const getExpeditionResetNow = () => {
  const forced = process.env.EXPEDITION_RESET_NOW?.trim();
  if (forced) {
    const parsed = new Date(forced);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return new Date();
};

// Resume only when a confirmed date is configured, never at an assumed Q1 boundary.
export const areExpeditionsPaused = (now = getExpeditionResetNow()) =>
  now >= new Date(schedule.pauseStartsAt) &&
  (!schedule.resumeAt || now < new Date(schedule.resumeAt));

export const filterPausedExpeditionProjects = <T extends { slug: string }>(
  projects: T[],
  now = getExpeditionResetNow()
) => areExpeditionsPaused(now)
  ? projects.filter((project) => !isExpeditionProjectSlug(project.slug))
  : projects;

export const getExpeditionResetWindow = (
  projects: ScheduledProject[],
  now = getExpeditionResetNow()
) => {
  const paused = areExpeditionsPaused(now);
  const force =
    process.env.EXPEDITION_RESET_FORCE?.trim().toLowerCase() ?? "";
  const forceActive = force === "true" || force === "1" || force === "yes";
  const upcomingCycle = projects
    .filter((project) => isExpeditionProjectSlug(project.slug))
    .map((project) => ({
      ...project,
      expeditionEnd: project.expeditionEndAt
        ? new Date(project.expeditionEndAt)
        : null,
    }))
    .filter(
      (project): project is typeof project & { expeditionEnd: Date } =>
        Boolean(
          project.expeditionEnd &&
            !Number.isNaN(project.expeditionEnd.valueOf()) &&
            ((paused && project.expeditionEnd.toISOString() === schedule.departureAt) ||
              forceActive ||
              now.valueOf() <
                project.expeditionEnd.valueOf() +
                  EXPEDITION_RESET_NOTICE_DURATION_MS)
        )
    )
    .sort((a, b) => a.expeditionEnd.valueOf() - b.expeditionEnd.valueOf())[0];

  if (!upcomingCycle) return null;

  const noticeStart = new Date(
    upcomingCycle.expeditionEnd.valueOf() - EXPEDITION_RESET_NOTICE_LEAD_TIME_MS
  );
  const noticeEnd = new Date(
    upcomingCycle.expeditionEnd.valueOf() + EXPEDITION_RESET_NOTICE_DURATION_MS
  );
  const noticeActive =
    forceActive || (now >= noticeStart && now < noticeEnd);

  return {
    cycleId: `${upcomingCycle.slug}-${upcomingCycle.expeditionEnd.toISOString()}`,
    noticeStartIso: noticeStart.toISOString(),
    noticeEndIso: noticeEnd.toISOString(),
    noticeActive,
  };
};
