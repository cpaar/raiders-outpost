import Link from "next/link";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { ProjectCardData } from "@/components/projects/projectCards";
import { cn } from "@/lib/cn";
import { HideoutMissingMaterials } from "@/components/projects/HideoutMissingMaterials";

export function ProjectCard({
  project,
  href,
  completedCount,
  totalCount,
  isCompleted,
  progressRatio,
  progressPercent,
  toggle,
}: ProjectCardData) {
  return (
    <div
      data-testid={`project-card-${project.slug}`}
      className={cn(
        "arc-panel arc-corners group relative flex flex-col overflow-hidden px-4 py-4 transition",
        project.kind !== "workshop" && "justify-center",
        href ? "hover:border-accent/60" : "",
        isCompleted
          ? "border-frame2/50 opacity-70 hover:border-frame2/60"
          : "border-frame2/70",
        toggle && !toggle.active && "border-frame2/60 hover:border-accent/50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {toggle ? (
            <button
              type="button"
              role="switch"
              aria-checked={toggle.active}
              aria-label={`${project.name} ${toggle.active ? toggle.activeLabel : toggle.inactiveLabel}`}
              data-testid={toggle.testId}
              onClick={toggle.onToggle}
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full border transition",
                toggle.active
                  ? "border-accent/80 bg-accent/20"
                  : "border-frame2/80 bg-panel hover:border-accent/70"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border transition",
                  toggle.active
                    ? "left-[18px] border-accent bg-accent/90"
                    : "left-[2px] border-frame2/80 bg-frame2"
                )}
              />
            </button>
          ) : null}
          {href ? (
            <Link
              href={href}
              className="min-w-0 flex-1"
              data-testid={`project-card-link-${project.slug}`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] break-words sm:text-sm text-text">
                {project.name}
              </h3>
            </Link>
          ) : (
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] break-words sm:text-sm text-text">
              {project.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="min-w-[48px] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
            data-project-count={`${completedCount}/${totalCount}`}
          >
            {completedCount} / {totalCount}
          </span>
          <ProgressRing
            radius={8}
            strokeWidth={2}
            size={24}
            progress={progressRatio}
            data-project-progress={progressPercent}
            className={cn("h-6 w-6", isCompleted && "opacity-80")}
            trackColor={
              isCompleted
                ? "rgba(160, 180, 190, 0.2)"
                : "rgba(160, 180, 190, 0.35)"
            }
            progressColor={
              isCompleted
                ? "rgba(160, 180, 190, 0.42)"
                : "rgba(72, 199, 214, 0.75)"
            }
          />
        </div>
      </div>
      {project.kind === "workshop" || project.slug === "sheltered_retreat_project" ? (
        <HideoutMissingMaterials project={project} />
      ) : null}
    </div>
  );
}
