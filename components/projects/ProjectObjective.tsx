import { Check } from "lucide-react";
import type { ProjectItemProgress } from "@/types/projects";
import { cn } from "@/lib/cn";
import { isItemComplete } from "@/lib/progress";

export function ProjectObjective({ item, onAdjust }: {
  item: ProjectItemProgress;
  onAdjust: (projectItemId: string, nextQuantity: number) => void;
}) {
  const completed = isItemComplete(item);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      disabled={!item.projectItemId}
      onClick={() => onAdjust(item.projectItemId, completed ? 0 : 1)}
      data-testid={`project-objective-${item.itemId}`}
      className={cn(
        "flex w-full items-start gap-3 border border-frame2/70 bg-panel2/60 p-3 text-left text-sm text-text transition hover:border-accent/70 focus-visible:outline focus-visible:outline-accent",
        completed && "border-accent/50 text-accent"
      )}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-current">
        {completed ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      <span className="min-w-0 flex-1">{item.displayName}</span>
    </button>
  );
}
