"use client";

import { useState } from "react";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { useLabels } from "@/components/locale/useLabels";
import { Button } from "@/components/ui/Button";
import { useLocalIdentity } from "@/components/auth/useLocalIdentity";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useExpeditionReset } from "@/hooks/useExpeditionReset";
import { ExpeditionResetDialog } from "@/components/expeditions/ExpeditionResetDialog";
import { Radar } from "lucide-react";

export function ExpeditionResetNotice() {
  const labels = useLabels();
  const { locale } = useLocale();
  const { identity, ready, clearIdentity } = useLocalIdentity();
  const { expeditionReset, refreshProjects } =
    useProjectContext();
  const [openDialog, setOpenDialog] = useState(false);
  const { saving, errorKey, dismissNotice, resetProgress } = useExpeditionReset({
    token: identity?.token ?? null,
    locale,
    onInvalid: clearIdentity,
    onUpdated: refreshProjects,
  });

  const shouldShowNotice = Boolean(
    ready && identity && expeditionReset?.showNotice
  );

  if (!shouldShowNotice) return null;

  return (
    <>
      <div className="mx-auto w-full max-w-[1480px] px-2 pt-2 lg:px-4 lg:pt-4">
        <div
          className="arc-panel arc-corners bg-panel2/70 px-3 py-3"
          style={{
            borderColor: "rgba(126, 201, 255, 0.75)",
            boxShadow: "none",
          }}
          data-testid="expedition-reset-notice"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center border border-accent/70 bg-panel">
              <Radar className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text">
                {labels.expeditionResetNoticeTitle}
              </h3>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
                {labels.expeditionResetNoticeBody}
              </div>
              {errorKey ? (
                <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-warn">
                  {labels[errorKey]}
                </div>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="h-8 px-3 border-accent text-text"
                  onClick={() => setOpenDialog(true)}
                  data-testid="expedition-reset-open-dialog"
                  disabled={saving}
                >
                  {labels.expeditionResetCta}
                </Button>
              </div>
            </div>
            <button
              type="button"
              className="h-6 w-6 border border-frame2 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-accent/70 hover:text-text"
              onClick={() => {
                dismissNotice();
              }}
              disabled={saving}
              data-testid="expedition-reset-dismiss"
              aria-label={labels.closeOverlay}
            >
              X
            </button>
          </div>
        </div>
      </div>
      {openDialog ? (
        <ExpeditionResetDialog
          onClose={() => setOpenDialog(false)}
          onConfirmReset={async () => {
            const success = await resetProgress();
            if (success) {
              setOpenDialog(false);
            }
            return success;
          }}
          loading={saving}
          error={errorKey ? labels[errorKey] : ""}
        />
      ) : null}
    </>
  );
}
