import { useLabels } from "@/components/locale/useLabels";
import { ItemTileMedia } from "@/components/items/ItemTileMedia";
import { getMissingProjectItems, getProgressStats } from "@/lib/progress";
import { useLocale } from "@/components/locale/LocaleProvider";
import type { ProjectProgress } from "@/types/projects";

export function HideoutMissingMaterials({ project }: { project: ProjectProgress }) {
  const labels = useLabels();
  const { locale } = useLocale();
  const items = getMissingProjectItems(project.stages);
  const complete = getProgressStats(project.stages.flatMap((stage) => stage.items)).isCompleted;

  return (
    <div className="mt-2" data-testid={`hideout-needs-${project.slug}`}>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={labels.missingMaterials}>
          {items.map((item) => (
            <li
              key={item.itemId}
              className="relative h-11 w-11 shrink-0 border border-frame2/70 bg-panel2/60"
              title={`${item.displayName}: ${item.quantityMissing}`}
              aria-label={`${item.displayName}: ${item.quantityMissing}`}
              data-testid={`hideout-needs-item-${item.itemId}`}
              data-missing={item.quantityMissing}
            >
              <ItemTileMedia
                imageFile={item.imageFile}
                wrapperClassName="absolute inset-1 flex items-center justify-center"
                imgClassName="h-full w-full object-contain"
              />
              <span className="absolute bottom-0 right-0 bg-panel/90 px-1 font-mono text-[10px] font-semibold leading-4 tabular-nums text-accent">
                {item.quantityMissing}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="hud-label text-[10px]">{complete ? labels.completeLabel : locale === "de" ? "Aufgaben offen" : "Objectives remaining"}</span>
      )}
    </div>
  );
}
