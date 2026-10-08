import fs from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import type { AppLocale } from "@/lib/locale";
import {
  getOverridePath,
  listOverrideDir,
  mergeWithOverride,
  readJsonFileIfExists,
} from "@/lib/arc-overrides";

export type ArcItem = {
  id?: string;
  name: string;
  rarity: string;
  itemType: string;
  foundIn?: string;
  imageFile: string | null;
};

export type ArcItemPayload = {
  scrapedAt: string;
  count: number;
  items: ArcItem[];
};

const ARC_ITEM_ID_ALIASES: Record<string, string> = {
  colorful_shoes_rare: "colorful_shoes_red",
  colorful_shoes_epic: "colorful_shoes_green",
  colorful_shoes_legendary: "colorful_shoes_silver",
};

const ARC_ITEM_ID_REVERSE_ALIASES = Object.entries(ARC_ITEM_ID_ALIASES).reduce<
  Record<string, string[]>
>((acc, [aliasId, canonicalId]) => {
  acc[canonicalId] ??= [];
  acc[canonicalId].push(aliasId);
  return acc;
}, {});

export const resolveArcItemIdAlias = (itemId: string): string =>
  ARC_ITEM_ID_ALIASES[itemId] ?? itemId;

export const getArcItemLookupKeys = (itemId: string): string[] => {
  const canonicalId = resolveArcItemIdAlias(itemId);
  const keys = new Set<string>([itemId, canonicalId]);
  for (const aliasId of ARC_ITEM_ID_REVERSE_ALIASES[itemId] ?? []) {
    keys.add(aliasId);
  }
  for (const aliasId of ARC_ITEM_ID_REVERSE_ALIASES[canonicalId] ?? []) {
    keys.add(aliasId);
  }
  return [...keys];
};

type ArcItemWithMeta = Omit<ArcItem, "id" | "foundIn"> & {
  id: string;
  foundIn: string | undefined;
  updatedAt: string | undefined;
};

const DATA_DIR = path.join(
  process.cwd(),
  "node_modules/arcraiders-data/items"
);
const IMAGE_DIR = path.join(
  process.cwd(),
  "node_modules/arcraiders-data/images/items"
);
const UPSCALED_IMAGE_DIR = path.join(
  process.cwd(),
  "node_modules/arcraiders-data/images/items_upscaled"
);

type ArcItemSource = {
  id: string;
  name?: Record<string, string>;
  type?: string;
  rarity?: string;
  foundIn?: string;
  imageFilename?: string;
  updatedAt?: string;
};

const resolveName = (
  name: Record<string, string> | undefined,
  locale: AppLocale,
  fallback: string
) => {
  if (!name) return fallback;
  return name[locale] ?? name.en ?? name.de ?? name.fr ?? fallback;
};

const parseUpdatedAt = (value?: string) => {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map((entry) => Number(entry));
  if (!month || !day || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const readArcItems = (locale: AppLocale) =>
  unstable_cache(
    async (): Promise<ArcItemPayload> => {
    const [
      baseItemFiles,
      overrideItemFiles,
      imageFiles,
      upscaledImageFiles,
      overrideImageFiles,
    ] = await Promise.all([
      fs.readdir(DATA_DIR).catch(() => [] as string[]),
      listOverrideDir("items"),
      fs.readdir(IMAGE_DIR).catch(() => [] as string[]),
      fs.readdir(UPSCALED_IMAGE_DIR).catch(() => [] as string[]),
      listOverrideDir("images", "items"),
    ]);

    const jsonItems = new Set<string>([
      ...baseItemFiles.filter((file) => file.endsWith(".json")),
      ...overrideItemFiles.filter((file) => file.endsWith(".json")),
    ]);

    const imageSet = new Set([
      ...imageFiles,
      ...upscaledImageFiles,
      ...overrideImageFiles,
    ]);

    const items = await Promise.all(
      [...jsonItems].sort().map(async (file) => {
        const basePath = path.join(DATA_DIR, file);
        const overridePath = getOverridePath("items", file);
        const base = await readJsonFileIfExists<ArcItemSource>(basePath);
        const overlay = await readJsonFileIfExists<ArcItemSource>(overridePath);
        const item = mergeWithOverride(base ?? undefined, overlay ?? undefined);
        if (!item) return null;
        const id = item.id ?? file.replace(/\\.json$/, "");
        const candidateImage =
          item.imageFilename && item.imageFilename.includes("/")
            ? path.basename(item.imageFilename)
            : item.imageFilename;
        const imageFile =
          candidateImage && imageSet.has(candidateImage)
            ? candidateImage
            : imageSet.has(`${id}.png`)
              ? `${id}.png`
              : null;
        return {
          id,
          name: resolveName(item.name, locale, id),
          rarity: item.rarity ?? "Unknown",
          itemType: item.type ?? "Unknown",
          foundIn: item.foundIn,
          imageFile,
          updatedAt: item.updatedAt,
        };
      })
    );

    const filteredItems = items.filter(
      (item): item is ArcItemWithMeta => Boolean(item)
    );

    const latestUpdated = filteredItems
      .map((item) => parseUpdatedAt(item.updatedAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      scrapedAt: (latestUpdated ?? new Date()).toISOString(),
      count: filteredItems.length,
      items: filteredItems
        .map(({ updatedAt, ...rest }) => rest)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    },
    ["arc-items-v3", locale],
    { revalidate: 3600 }
  );

export const loadArcItems = async (
  locale: AppLocale = "de"
): Promise<ArcItemPayload> => {
  return readArcItems(locale)();
};
