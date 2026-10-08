import type { ProjectProgress } from "@/types/projects";
import { isExpeditionProjectSlug } from "@/lib/expeditions";

export type ProjectDisplayCategory = "blueprints" | "hideout" | "projects";

type ProjectCategoryOptions = {
  availableExpeditionSlug?: string | null;
};

export const getProjectDisplayCategory = (
  project: Pick<ProjectProgress, "kind" | "slug">,
  options?: ProjectCategoryOptions
): ProjectDisplayCategory | null => {
  if (project.kind === "blueprints") {
    return "blueprints";
  }
  if (project.kind === "workshop") {
    return "hideout";
  }
  if (project.kind !== "project") {
    return null;
  }
  if (!isExpeditionProjectSlug(project.slug)) {
    return "projects";
  }
  if (options?.availableExpeditionSlug === project.slug) {
    return "projects";
  }
  return null;
};

export const filterProjectsByCategory = <
  T extends Pick<ProjectProgress, "kind" | "slug">
>(
  projects: T[],
  category: ProjectDisplayCategory,
  options?: ProjectCategoryOptions
) =>
  projects.filter(
    (project) => getProjectDisplayCategory(project, options) === category ||
      (category === "hideout" && project.slug === "sheltered_retreat_project")
  );

export const isUserToggleProject = (
  project: Pick<ProjectProgress, "kind" | "slug">,
  options?: ProjectCategoryOptions
) => getProjectDisplayCategory(project, options) === "projects";
