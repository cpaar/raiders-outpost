"use client";

import { useEffect, useRef, useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { useLabels } from "@/components/locale/useLabels";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { ProjectDashboard } from "@/components/projects/ProjectDashboard";
import { Panel } from "@/components/ui/Panel";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";

import type { ProjectProgress } from "@/types/projects";
import type { CollectionSlug } from "@/lib/collections";

export function CollectionItems({ project, slug, loading }: {
  project: ProjectProgress | null;
  slug: CollectionSlug;
  loading: boolean;
}) {
  const labels = useLabels();
  const queryStorageKey = `project-filter-${slug}-query`;
  const neededOnlyStorageKey = `project-filter-${slug}-needed`;
  const [query, setQuery, queryHydrated] = useLocalStorageState<string>(
    queryStorageKey,
    "",
    {
      deserialize: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          return typeof parsed === "string" ? parsed : raw;
        } catch {
          return raw;
        }
      },
      serialize: (value) => JSON.stringify(value),
    }
  );
  const [neededOnly, setNeededOnly, neededOnlyHydrated] = useLocalStorageState<boolean>(
    neededOnlyStorageKey,
    false,
    {
      deserialize: (raw) => {
        if (raw === "true" || raw === "false") {
          return raw === "true";
        }
        try {
          return JSON.parse(raw);
        } catch {
          return false;
        }
      },
      serialize: (value) => (value ? "true" : "false"),
    }
  );
  const filtersHydrated = queryHydrated && neededOnlyHydrated;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  return (
    <Panel className="overflow-hidden">
      <div className="arc-panel-header flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="hud-label">{labels.navBlueprints}</p>
          <h2 className="text-lg font-semibold uppercase tracking-[0.08em]">
            {project ? project.name : labels.navBlueprints}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            type="button"
            aria-pressed={neededOnly}
            data-testid="collection-needed-filter"
            aria-label={labels.filterNeededOnly}
            onClick={() => setNeededOnly((prev) => !prev)}
            active={neededOnly}
          >
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{labels.neededOnly}</span>
          </IconButton>
          <IconButton
            type="button"
            aria-pressed={searchOpen}
            data-testid="collection-search-toggle"
            aria-label={labels.quicksearch}
            onClick={() => setSearchOpen((prev) => !prev)}
            active={searchOpen}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{labels.quicksearch}</span>
          </IconButton>
        </div>
      </div>
      <div className="border-t border-frame2 px-2 py-5">
        {searchOpen ? (
          <div className="mb-4 flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">{labels.quicksearch}</span>
              <input
                data-testid="collection-search"
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.searchPlaceholder}
                className="h-8 w-full border-b border-frame2 bg-transparent px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
              />
            </label>
          </div>
        ) : null}
        {!filtersHydrated ? (
          <div className="text-sm uppercase tracking-[0.08em] text-muted">
            {labels.scanningProjectCache}
          </div>
        ) : loading && !project ? (
          <div className="text-sm uppercase tracking-[0.08em] text-muted">
            {labels.scanningProjectCache}
          </div>
        ) : project ? (
          <ProjectDashboard
            project={project}
            query={query}
            neededOnly={neededOnly}
          />
        ) : (
          <EmptyState className="px-2">
            {labels.noProjectData}
          </EmptyState>
        )}
      </div>
      {slug !== "blueprints" ? (
        <p className="border-t border-frame2 px-3 py-2 text-xs text-muted">
          {labels.collectionImageSource}
          <a
            href="https://metaforge.app/arc-raiders"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-text"
          >
            MetaForge
          </a>
        </p>
      ) : null}
    </Panel>
  );
}
