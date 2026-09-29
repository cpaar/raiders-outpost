"use client";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { Button } from "@/components/ui/Button";
import { useLabels } from "@/components/locale/useLabels";

type ExpeditionResetDialogProps = {
  onClose: () => void;
  onConfirmReset: () => Promise<boolean>;
  loading: boolean;
  error: string;
};

export function ExpeditionResetDialog({
  onClose,
  onConfirmReset,
  loading,
  error,
}: ExpeditionResetDialogProps) {
  const labels = useLabels();
  const { expeditionsPaused } = useProjectContext();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <button
        type="button"
        aria-label={labels.closeOverlay}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md">
        <div className="arc-panel arc-corners overflow-hidden" data-testid="expedition-reset-dialog">
          <div className="arc-panel-header">
            <div>
              <p className="hud-label">{labels.expeditionResetDialogLabel}</p>
              <h3 className="text-base font-semibold uppercase tracking-[0.12em]">
                {labels.expeditionResetDialogTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-6 w-6 border border-frame2 text-xs font-semibold uppercase tracking-[0.12em] text-muted"
                data-testid="expedition-reset-close"
              >
                X
              </button>
            </div>
          </div>
          <div className="border-t border-frame2 bg-panel/80 px-2 py-4">
            <div data-testid="expedition-reset-step-confirm">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">
                {labels.expeditionResetExplainLine1}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted">
                {expeditionsPaused ? labels.expeditionPauseBody : labels.expeditionResetExplainLine2}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                {labels.expeditionResetExplainLine3}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.08em] text-text">
                {labels.expeditionResetScopeLine}
              </div>
            </div>
            {error ? (
              <div className="mt-3 text-[11px] uppercase tracking-[0.08em] text-warn">
                {error}
              </div>
            ) : null}
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="default"
                className="h-9 flex-1 border-frame2 text-muted hover:border-accent/60"
                onClick={onClose}
                disabled={loading}
              >
                {labels.cancel}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-9 flex-1"
                onClick={async () => {
                  const ok = await onConfirmReset();
                  if (ok) onClose();
                }}
                disabled={loading}
                data-testid="expedition-reset-confirm"
              >
                {labels.expeditionResetConfirm}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
