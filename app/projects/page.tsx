"use client";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { useLabels } from "@/components/locale/useLabels";
import { filterProjectsByCategory } from "@/lib/project-categories";
import { ProjectSelectionPanel } from "@/components/projects/ProjectSelectionPanel";
import { getProjectCards } from "@/components/projects/projectCards";
import { ExpeditionPauseNotice } from "@/components/expeditions/ExpeditionPauseNotice";
import { useMemo } from "react";

export default function ProjectsPage() {
  const {
    allProjects,
    loading,
    toggleProjectActive,
    isProjectActive,
    projectVisibilityHydrated,
    activeExpeditionSlug,
    expeditionsPaused,
  } = useProjectContext();
  const labels = useLabels();
  const projects = filterProjectsByCategory(allProjects, "projects", {
    availableExpeditionSlug: expeditionsPaused ? null : activeExpeditionSlug,
  });
  const sortedProjects = projects.slice().sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const cards = useMemo(
    () =>
      getProjectCards(sortedProjects, (project) =>
        isProjectActive(project.slug)
          ? `/projects/${project.slug}?from=projects`
          : null
      ).map((card) => ({
        ...card,
        toggle: {
          active: isProjectActive(card.project.slug),
          activeLabel: labels.activeLabel,
          inactiveLabel: labels.inactiveLabel,
          onToggle: () => toggleProjectActive(card.project.slug),
          testId: `project-toggle-${card.project.slug}`,
        },
      })),
    [
      isProjectActive,
      labels.activeLabel,
      labels.inactiveLabel,
      sortedProjects,
      toggleProjectActive,
    ]
  );

  return (
    <div className="flex flex-col gap-4">
      <ExpeditionPauseNotice />
      <ProjectSelectionPanel
        title={labels.navProjects}
        projects={sortedProjects}
        loading={loading || !projectVisibilityHydrated}
        testIdPrefix="project"
        cards={cards}
      />
    </div>
  );
}
