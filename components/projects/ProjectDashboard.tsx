"use client";

import { useCallback, useMemo } from "react";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { ProjectStagePanel } from "@/components/projects/ProjectStagePanel";
import {
  ProjectStageStepMarker,
  ProjectStageStepper,
} from "@/components/projects/ProjectStageStepper";
import type { ProjectProgress } from "@/types/projects";
import { useLabels } from "@/components/locale/useLabels";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

type ProjectDashboardProps = {
  query: string;
  neededOnly: boolean;
  project?: ProjectProgress | null;
};

export function ProjectDashboard({
  query,
  neededOnly,
  project,
}: ProjectDashboardProps) {
  const labels = useLabels();
  const {
    loading,
    selectedProject,
    updateItemQuantity,
  } = useProjectContext();
  const activeProject = project ?? selectedProject;

  const filteredStages = useMemo(() => {
    if (!activeProject) return [];
    const q = query.trim().toLowerCase();
    if (!neededOnly && !q) {
      return activeProject.stages;
    }
    return activeProject.stages.map((stage) => ({
      ...stage,
      items: stage.items.filter((item) => {
        if (neededOnly && item.quantityOwned >= item.quantityRequired) {
          return false;
        }
        if (!q) return true;
        return (
          item.displayName.toLowerCase().includes(q) ||
          item.itemId.toLowerCase().includes(q)
        );
      }),
    }));
  }, [activeProject, neededOnly, query]);

  const sortedStages = useMemo(
    () => filteredStages.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [filteredStages]
  );

  const stageItemsByKey = useMemo(() => {
    if (!activeProject) {
      return new Map<string, ProjectProgress["stages"][number]["items"]>();
    }
    return new Map(
      activeProject.stages.map((stage) => [stage.stageKey, stage.items])
    );
  }, [activeProject]);

  const stageCompletionStatus = useMemo(() => {
    if (!activeProject) return {};
    return activeProject.stages.reduce((acc, stage) => {
      const isCompletedStage =
        stage.items.length === 0 ||
        stage.items.every((item) => {
          if (item.quantityRequired <= 0) {
            return true;
          }
          return item.quantityOwned >= item.quantityRequired;
        });
      acc[stage.stageKey] = isCompletedStage;
      return acc;
    }, {} as Record<string, boolean>);
  }, [activeProject]);

  const stageToggleDisabledStatus = useMemo(() => {
    if (!activeProject) return {};
    return activeProject.stages.reduce((acc, stage) => {
      const hasAdjustableItem = stage.items.some(
        (item) => Boolean(item.projectItemId) && item.quantityRequired > 0
      );
      acc[stage.stageKey] = !hasAdjustableItem;
      return acc;
    }, {} as Record<string, boolean>);
  }, [activeProject]);

  const useMultiStageRailLayout = activeProject?.kind !== "blueprints";

  const handleToggleStageCompletion = useCallback(
    (stageKey: string) => {
      const stageItems = stageItemsByKey.get(stageKey);
      if (!stageItems?.length) return;

      const isCompleted = Boolean(stageCompletionStatus[stageKey]);
      stageItems.forEach((item) => {
        if (!item.projectItemId || item.quantityRequired <= 0) {
          return;
        }
        const nextQuantity = isCompleted ? 0 : item.quantityRequired;
        if (item.quantityOwned === nextQuantity) {
          return;
        }
        updateItemQuantity(item.projectItemId, nextQuantity);
      });
    },
    [stageCompletionStatus, stageItemsByKey, updateItemQuantity]
  );

  if (loading && !activeProject) {
    return (
      <div className="text-sm uppercase tracking-[0.08em] text-muted">
        {labels.scanningProjectCache}
      </div>
    );
  }

  return activeProject ? (
    <div className="flex flex-col gap-4">
      {useMultiStageRailLayout ? (
        <div className="border border-frame2/70 bg-panel/70">
          <div className="hidden border-b border-frame2/70 lg:block">
            <ProjectStageStepper
              stages={sortedStages.map((stage) => ({
                stageKey: stage.stageKey,
                name: stage.name,
              }))}
              completionStatus={stageCompletionStatus}
              onToggleStageCompletion={handleToggleStageCompletion}
              disableToggleStatus={stageToggleDisabledStatus}
            />
          </div>
          <div className="hidden overflow-x-auto p-2.5 lg:block" data-testid="project-stage-columns">
            <div
              className="grid min-w-full gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(sortedStages.length, 1)}, minmax(220px, 1fr))`,
              }}
            >
              {sortedStages.map((stage) => {
                const progressItems = stageItemsByKey.get(stage.stageKey) ?? stage.items;
                return (
                  <ProjectStagePanel
                    key={stage.stageKey}
                    stage={stage}
                    onAdjust={updateItemQuantity}
                    stripBlueprintLabel={activeProject.kind === "blueprints"}
                    progressItems={progressItems}
                    layoutVariant="column"
                    itemGridVariant="adaptiveColumns"
                  />
                );
              })}
            </div>
          </div>
          <div className="relative lg:hidden" data-testid="project-stage-vertical-layout">
            <div className="space-y-3 px-2 py-3">
              {sortedStages.map((stage, index) => {
                const progressItems = stageItemsByKey.get(stage.stageKey) ?? stage.items;
                const isCompleted = Boolean(stageCompletionStatus[stage.stageKey]);
                const previousCompleted =
                  index > 0
                    ? Boolean(stageCompletionStatus[sortedStages[index - 1]?.stageKey])
                    : false;
                return (
                  <div key={stage.stageKey} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2">
                    <div className="relative flex items-center justify-center">
                      {index > 0 ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute left-1/2 -translate-x-1/2 top-[-6px] bottom-[calc(50%+10px)] w-px",
                            previousCompleted ? "bg-accent/60" : "bg-frame2/80"
                          )}
                          aria-hidden="true"
                          data-testid="project-stage-step-line-vertical"
                        />
                      ) : null}
                      {index < sortedStages.length - 1 ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(50%+10px)] bottom-[-6px] w-px",
                            isCompleted ? "bg-accent/60" : "bg-frame2/80"
                          )}
                          aria-hidden="true"
                          data-testid="project-stage-step-line-vertical"
                        />
                      ) : null}
                      <ProjectStageStepMarker
                        stageKey={stage.stageKey}
                        completed={isCompleted}
                        onClick={handleToggleStageCompletion}
                        disabled={Boolean(stageToggleDisabledStatus[stage.stageKey])}
                      />
                    </div>
                    <ProjectStagePanel
                      stage={stage}
                      onAdjust={updateItemQuantity}
                      stripBlueprintLabel={activeProject.kind === "blueprints"}
                      progressItems={progressItems}
                      layoutVariant="column"
                      itemGridVariant="twoRows"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-frame2/70 border border-frame2/70 bg-panel/70">
          {sortedStages.map((stage) => {
            const progressItems = stageItemsByKey.get(stage.stageKey) ?? stage.items;
            return (
              <ProjectStagePanel
                key={stage.stageKey}
                stage={stage}
                onAdjust={updateItemQuantity}
                stripBlueprintLabel={activeProject.kind === "blueprints"}
                progressItems={progressItems}
              />
            );
          })}
        </div>
      )}
    </div>
  ) : (
    <EmptyState className="px-2">
      {labels.noProjectData}
    </EmptyState>
  );
}
