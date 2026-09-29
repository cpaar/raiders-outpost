"use client";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { useLabels } from "@/components/locale/useLabels";

export function ExpeditionPauseNotice() {
  const { expeditionsPaused } = useProjectContext();
  const labels = useLabels();
  if (!expeditionsPaused) return null;

  return (
    <div className="arc-panel arc-corners px-3 py-3" data-testid="expedition-pause-notice">
      <p className="hud-label">{labels.expeditionPauseTitle}</p>
      <p className="mt-2 text-xs text-muted">{labels.expeditionPauseBody}</p>
      <p className="mt-2 text-xs text-muted">{labels.expeditionPauseReset}</p>
    </div>
  );
}
