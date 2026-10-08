import fs from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import {
  getArcItemLookupKeys,
  loadArcItems,
} from "@/lib/arc-items";
import { stripBlueprintLabel, stripFurnitureDesignLabel } from "@/lib/item-labels";
import type { AppLocale } from "@/lib/locale";
import { COLLECTIONS } from "@/lib/collections";
import {
  getOverridePath,
  listOverrideDir,
  mergeWithOverride,
  readJsonFileIfExists,
} from "@/lib/arc-overrides";

export type ArcProjectItem = {
  itemId: string;
  displayName: string;
  quantityRequired: number;
  kind?: "objective";
};

export type ArcProjectStage = {
  stageKey: string;
  name: string;
  sortOrder: number;
  items: ArcProjectItem[];
  prerequisite?: string;
};

export type ArcProject = {
  slug: string;
  name: string;
  kind: "workshop" | "project" | "blueprints" | "collection";
  repeatable: boolean;
  timeLimitedUntil: string | null;
  startAt: string | null;
  endAt: string | null;
  expeditionEndAt: string | null;
  stages: ArcProjectStage[];
};

export type ArcProjectPayload = {
  scrapedAt: string;
  sourceUrl: string;
  projects: ArcProject[];
};

const DATA_PATH = path.join(
  process.cwd(),
  "node_modules/arcraiders-data/projects.json"
);
const HIDEOUT_DIR = path.join(
  process.cwd(),
  "node_modules/arcraiders-data/hideout"
);

type ArcProjectSource = {
  id: string;
  disabled?: boolean;
  startDate?: number;
  endDate?: number;
  expeditionEndDate?: number;
  name?: Record<string, string>;
  phases?: {
    name?: Record<string, string>;
    phase?: number;
    requirementItemIds?: { itemId: string; quantity: number }[];
    objectives?: { id: string; name: Record<string, string> }[];
  }[];
};

type ArcHideoutSource = {
  id: string;
  name?: Record<string, string>;
  maxLevel?: number;
  levels?: {
    level?: number;
    requirementItemIds?: { itemId: string; quantity: number }[];
    requires?: { outpostRooms?: number }[];
  }[];
};

const resolveName = (
  name: Record<string, string> | undefined,
  locale: AppLocale,
  fallback: string
) => {
  if (!name) return fallback;
  return name[locale] ?? name.en ?? name.de ?? fallback;
};

const unixTimestampToIso = (timestamp: number | undefined) => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp * 1000).toISOString();
};

const buildCollections = async (
  locale: AppLocale
): Promise<ArcProject[]> => {
  const items = await loadArcItems(locale);
  return COLLECTIONS.map((collection) => {
    const entries = items.items
      .filter((item) => item.itemType === collection.itemType)
      .map((item) => ({
        itemId:
          item.id ?? item.imageFile?.replace(/\.[^/.]+$/, "") ?? "unknown",
        displayName: collection.itemType === "Design"
          ? stripFurnitureDesignLabel(item.name)
          : item.name,
        quantityRequired: 1,
      }))
      .sort((a, b) =>
        stripBlueprintLabel(a.displayName).localeCompare(
          stripBlueprintLabel(b.displayName),
          locale,
          {
          sensitivity: "base",
          }
        )
      );

    return {
      slug: collection.slug,
      name: collection.name[locale],
      kind: collection.slug === "blueprints" ? "blueprints" : "collection",
      repeatable: false,
      timeLimitedUntil: null,
      startAt: null,
      endAt: null,
      expeditionEndAt: null,
      stages: [
        {
          stageKey: "phase-1",
          name: "Phase 01",
          sortOrder: 1,
          items: entries,
        },
      ],
    } satisfies ArcProject;
  });
};

const resolveHideoutStageName = (locale: AppLocale, level: number) => {
  const label = String(level).padStart(2, "0");
  return locale === "de" ? `Stufe ${label}` : `Level ${label}`;
};

const mapHideoutProject = (
  entry: ArcHideoutSource,
  itemNameMap: Map<string, string>,
  locale: AppLocale
): ArcProject => {
  const stages =
    entry.levels?.map((level) => {
      const sortOrder = Number(level.level ?? 0);
      return {
        stageKey: `level-${sortOrder || 0}`,
        name: resolveHideoutStageName(locale, sortOrder || 0),
        sortOrder,
        prerequisite: level.requires?.map((requirement) =>
          requirement.outpostRooms
            ? locale === "de"
              ? `Benötigt ${requirement.outpostRooms} ${requirement.outpostRooms === 1 ? "Außenposten-Raum" : "Außenposten-Räume"}.`
              : `Requires ${requirement.outpostRooms} Outpost ${requirement.outpostRooms === 1 ? "room" : "rooms"}.`
            : ""
        ).filter(Boolean).join(" ") || undefined,
        items:
          level.requirementItemIds?.map((item) => ({
            itemId: item.itemId,
            displayName:
              itemNameMap.get(item.itemId) ?? item.itemId ?? "Unknown",
            quantityRequired: Number(item.quantity ?? 0),
          })) ?? [],
      };
    }) ?? [];

  return {
    slug: entry.id,
    name: resolveName(entry.name, locale, entry.id),
    kind: "workshop",
    repeatable: false,
    timeLimitedUntil: null,
    startAt: null,
    endAt: null,
    expeditionEndAt: null,
    stages,
  };
};

const mapProject = (
  project: ArcProjectSource,
  itemNameMap: Map<string, string>,
  locale: AppLocale
): ArcProject => {
  const stages =
    project.phases?.map((phase) => {
      const sortOrder = Number(phase.phase ?? 0);
      return {
        stageKey: `phase-${sortOrder || 0}`,
        name:
          resolveName(
            phase.name,
            locale,
            `Phase ${String(sortOrder).padStart(2, "0")}`
          ),
        sortOrder,
        items: [
          ...(phase.requirementItemIds?.map((item) => ({
            itemId: item.itemId,
            displayName:
              itemNameMap.get(item.itemId) ?? item.itemId ?? "Unknown",
            quantityRequired: Number(item.quantity ?? 0),
          })) ?? []),
          // Stable objective IDs reuse the existing per-user progress persistence.
          ...(phase.objectives?.map((objective) => ({
            itemId: `objective:${project.id}:${objective.id}`,
            displayName: resolveName(objective.name, locale, objective.id),
            quantityRequired: 1,
            kind: "objective" as const,
          })) ?? []),
        ],
      };
    }) ?? [];

  return {
    slug: project.id,
    name: resolveName(project.name, locale, project.id),
    kind: "project",
    repeatable: false,
    timeLimitedUntil: null,
    startAt: unixTimestampToIso(project.startDate),
    endAt: unixTimestampToIso(project.endDate),
    expeditionEndAt: unixTimestampToIso(project.expeditionEndDate),
    stages,
  };
};

const readArcProjects = (locale: AppLocale) =>
  unstable_cache(
    async (): Promise<ArcProjectPayload> => {
    const [baseProjects, overrideProjects] = await Promise.all([
      readJsonFileIfExists<ArcProjectSource[]>(DATA_PATH),
      readJsonFileIfExists<ArcProjectSource[]>(getOverridePath("projects.json")),
    ]);
    const source =
      mergeWithOverride(baseProjects ?? undefined, overrideProjects ?? undefined) ??
      [];
    const items = await loadArcItems(locale);
    const itemNameMap = new Map<string, string>();
    for (const item of items.items) {
      const key = item.id ?? item.imageFile;
      if (key) {
        for (const lookupKey of getArcItemLookupKeys(key)) {
          itemNameMap.set(lookupKey, item.name);
        }
      }
    }

    const [baseHideoutFiles, overrideHideoutFiles] = await Promise.all([
      fs.readdir(HIDEOUT_DIR).catch(() => [] as string[]),
      listOverrideDir("hideout"),
    ]);
    const hideoutFiles = new Set<string>([
      ...baseHideoutFiles.filter((file) => file.endsWith(".json")),
      ...overrideHideoutFiles.filter((file) => file.endsWith(".json")),
    ]);
    const hideoutEntries = (
      await Promise.all(
        [...hideoutFiles].sort().map(async (file) => {
          const basePath = path.join(HIDEOUT_DIR, file);
          const overridePath = getOverridePath("hideout", file);
          const base = await readJsonFileIfExists<ArcHideoutSource>(basePath);
          const overlay = await readJsonFileIfExists<ArcHideoutSource>(overridePath);
          return mergeWithOverride(base ?? undefined, overlay ?? undefined);
        })
      )
    ).filter((entry): entry is ArcHideoutSource => Boolean(entry));

    const projects = source
      .filter((project) => !project.disabled)
      .map((project) => mapProject(project, itemNameMap, locale))
      .concat(
        hideoutEntries.map((entry) =>
          mapHideoutProject(entry, itemNameMap, locale)
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      scrapedAt: new Date().toISOString(),
      sourceUrl: "raidtheory/arcraiders-data",
      projects: [...projects, ...await buildCollections(locale)],
    };
    },
    ["arc-projects-v11", locale],
    { revalidate: 3600 }
  );

export const loadArcProjects = async (
  locale: AppLocale = "de"
): Promise<ArcProjectPayload> => {
  return readArcProjects(locale)();
};
