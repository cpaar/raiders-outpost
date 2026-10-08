import { COLLECTIONS, type CollectionSlug } from "@/lib/collections";
import { useLocale } from "@/components/locale/LocaleProvider";
import { getProgressStats } from "@/lib/progress";
import { cn } from "@/lib/cn";
import type { ProjectProgress } from "@/types/projects";

export function CollectionTabs({ projects, selected, onSelect }: {
  projects: ProjectProgress[];
  selected: CollectionSlug;
  onSelect: (slug: CollectionSlug) => void;
}) {
  const { locale } = useLocale();
  return (
    <div role="tablist" aria-label={locale === "de" ? "Sammlung" : "Collection"} className="grid grid-cols-3 border border-frame2 bg-panel/70">
      {COLLECTIONS.map((collection, index) => {
        const project = projects.find((entry) => entry.slug === collection.slug);
        const stats = project ? getProgressStats(project.stages.flatMap((stage) => stage.items)) : null;
        const active = selected === collection.slug;
        return (
          <button
            key={collection.slug}
            type="button"
            role="tab"
            aria-label={collection.name[locale]}
            id={`collection-tab-${collection.slug}`}
            aria-controls={`collection-panel-${collection.slug}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-testid={`collection-tab-${collection.slug}`}
            onClick={() => onSelect(collection.slug)}
            onKeyDown={(event) => {
              const nextIndex = event.key === "ArrowRight" ? (index + 1) % COLLECTIONS.length
                : event.key === "ArrowLeft" ? (index + COLLECTIONS.length - 1) % COLLECTIONS.length
                : event.key === "Home" ? 0 : event.key === "End" ? COLLECTIONS.length - 1 : null;
              if (nextIndex === null) return;
              event.preventDefault();
              const next = COLLECTIONS[nextIndex];
              onSelect(next.slug);
              document.getElementById(`collection-tab-${next.slug}`)?.focus();
            }}
            className={cn("min-w-0 border-b-2 px-2 py-3 text-left transition focus-visible:outline focus-visible:outline-accent sm:px-4", index > 0 && "border-l border-l-frame2", active ? "border-b-accent bg-accent/10 text-accent" : "border-b-transparent text-muted hover:text-text")}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] sm:text-xs">
              {collection.slug === "weapon_stencils" ? (
                <><span className="sm:hidden">{locale === "de" ? "Schablonen" : "Stencils"}</span><span className="hidden sm:inline">{collection.name[locale]}</span></>
              ) : collection.name[locale]}
            </span>
            <span className="mt-1 block font-mono text-xs" data-testid={`collection-count-${collection.slug}`}>
              {stats ? `${stats.completedCount} / ${stats.totalCount}` : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
