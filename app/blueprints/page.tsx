"use client";

import { CollectionItems } from "@/components/projects/CollectionItems";
import { CollectionTabs } from "@/components/projects/CollectionTabs";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { isCollectionSlug, type CollectionSlug } from "@/lib/collections";

export default function BlueprintsPage() {
  const { projects, loading } = useProjectContext();
  const [selected, setSelected] = useLocalStorageState<CollectionSlug>(
    "arc:collection:selected", "blueprints", {
      deserialize: (raw) => {
        try {
          const value: unknown = JSON.parse(raw);
          return isCollectionSlug(value) ? value : "blueprints";
        } catch {
          return "blueprints";
        }
      },
    }
  );
  return (
    <div className="flex flex-col gap-3">
      <CollectionTabs projects={projects} selected={selected} onSelect={setSelected} />
      <div role="tabpanel" id={`collection-panel-${selected}`} aria-labelledby={`collection-tab-${selected}`}>
        <CollectionItems key={selected} slug={selected} project={projects.find((project) => project.slug === selected) ?? null} loading={loading} />
      </div>
    </div>
  );
}
