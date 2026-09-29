"use client";

import { ExpeditionPauseNotice } from "@/components/expeditions/ExpeditionPauseNotice";
import { useMemo, useState } from "react";
import { useLocalIdentity } from "@/components/auth/useLocalIdentity";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  isExpeditionProjectSlug,
  orderExpeditionProjects,
  sanitizeCompletedExpeditionSlugs,
} from "@/lib/expeditions";
import { useLabels } from "@/components/locale/useLabels";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useAuthCode } from "@/hooks/useAuthCode";
import { useExpeditionSelection } from "@/hooks/useExpeditionSelection";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExpeditionResetDialog } from "@/components/expeditions/ExpeditionResetDialog";
import { useExpeditionReset } from "@/hooks/useExpeditionReset";
import { useLocale } from "@/components/locale/LocaleProvider";
import { usePublicProfileLink } from "@/hooks/usePublicProfileLink";

export default function RaiderPage() {
  const { identity, ready, clearIdentity } = useLocalIdentity();
  const {
    allProjects,
    loading: projectsLoading,
    refreshProjects,
    expeditionsPaused,
    expeditionReset,
  } = useProjectContext();
  const resetAlreadyRecorded = Boolean(expeditionReset?.completed);
  const { locale } = useLocale();
  const labels = useLabels();
  const [copied, setCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { authCode } = useAuthCode(identity?.token ?? null);
  const {
    activeExpeditionSlug,
    completedExpeditionSlugs,
    loading: loadingExpedition,
    saving: savingExpedition,
    errorKey: expeditionErrorKey,
    setCompletedExpeditions,
  } = useExpeditionSelection({
    token: identity?.token ?? null,
    onInvalid: clearIdentity,
    onUpdated: () => refreshProjects(),
  });

  const {
    saving: savingReset,
    errorKey: resetErrorKey,
    resetProgress,
  } = useExpeditionReset({
    token: identity?.token ?? null,
    locale,
    onInvalid: clearIdentity,
    onUpdated: refreshProjects,
  });
  const { publicUrl, loading: loadingPublicUrl } = usePublicProfileLink({
    token: identity?.token ?? null,
    onInvalid: clearIdentity,
  });

  const onCopy = async () => {
    if (!authCode) return;
    await copyTextToClipboard(authCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const onCopyPublicProfile = async () => {
    if (!publicUrl) return;
    await copyTextToClipboard(publicUrl);
    setProfileCopied(true);
    window.setTimeout(() => setProfileCopied(false), 1400);
  };

  const expeditionProjects = useMemo(
    () => {
      const filtered = allProjects.filter((project) =>
        isExpeditionProjectSlug(project.slug)
      );
      return orderExpeditionProjects(filtered);
    },
    [allProjects]
  );

  const activeExpeditionLabel = useMemo(() => {
    if (!activeExpeditionSlug) return labels.noExpedition;
    return (
      expeditionProjects.find(
        (project) => project.slug === activeExpeditionSlug
      )?.name ?? labels.unknownExpedition
    );
  }, [activeExpeditionSlug, expeditionProjects, labels]);

  const completedExpeditionSet = useMemo(
    () => new Set(completedExpeditionSlugs),
    [completedExpeditionSlugs]
  );

  const updateCompletedFromIndex = async (index: number, checked: boolean) => {
    const nextSet = new Set(completedExpeditionSlugs);
    if (checked) {
      for (let current = 0; current <= index; current += 1) {
        const slug = expeditionProjects[current]?.slug;
        if (slug) nextSet.add(slug);
      }
    } else {
      for (let current = index; current < expeditionProjects.length; current += 1) {
        const slug = expeditionProjects[current]?.slug;
        if (slug) nextSet.delete(slug);
      }
    }

    const nextCompleted = sanitizeCompletedExpeditionSlugs(
      Array.from(nextSet),
      expeditionProjects.map((project) => project.slug)
    );
    await setCompletedExpeditions(nextCompleted);
  };

  if (!ready) return null;

  if (!identity) {
    return (
      <EmptyState className="px-2">
        {labels.notSignedIn}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <div className="arc-panel-header">
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
            ARC // USER
          </span>
        </div>
        <div className="space-y-4 px-2 py-5">
          <div>
            <div className="hud-label">{labels.raiderLabel}</div>
            <div className="text-sm font-semibold uppercase tracking-[0.12em]">
              {identity.name}
            </div>
          </div>
          <div>
            <div className="hud-label">{labels.authCodeLabel}</div>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <div
                className="flex-1 rounded-[8px] border border-frame bg-panel2 px-3 py-2 font-mono text-[12px] text-text tracking-[0.2em]"
                aria-label={labels.authCodeValueAria}
                data-testid="operator-auth-code"
              >
                {authCode || "--------"}
              </div>
              <Button
                type="button"
                variant="default"
                onClick={onCopy}
                className="px-2 py-1 text-[10px]"
                disabled={!authCode}
              >
                {copied ? labels.copied : labels.copy}
              </Button>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
              {labels.authCodeHint}
            </div>
          </div>
          <div>
            <div className="hud-label">{labels.publicProfileLinkLabel}</div>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <div
                className="flex-1 rounded-[8px] border border-frame bg-panel2 px-3 py-2 font-mono text-[12px] text-text"
                aria-label={labels.publicProfileLinkAria}
                data-testid="operator-public-profile-link"
              >
                {publicUrl || (loadingPublicUrl ? "--------" : labels.notAvailable)}
              </div>
              <Button
                type="button"
                variant="default"
                onClick={onCopyPublicProfile}
                className="px-2 py-1 text-[10px]"
                disabled={!publicUrl}
                data-testid="operator-public-profile-copy"
              >
                {profileCopied ? labels.copied : labels.copy}
              </Button>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
              {labels.publicProfileLinkHint}
            </div>
          </div>
          <div>
            <div className="hud-label">{labels.onboardingCompletedExpeditionsLabel}</div>
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
              data-testid="expedition-config"
            >
              <span>{expeditionsPaused ? labels.expeditionPauseTitle : `${labels.activeExpeditionLabel}: ${activeExpeditionLabel}`}</span>
            </div>
            <div className="mt-3 space-y-2">
              {projectsLoading && !expeditionProjects.length ? (
                <div className="hud-empty-state flex h-8 items-center px-3 py-0 text-[10px] tracking-[0.16em]">
                  {labels.scanningExpeditionIndex}
                </div>
              ) : expeditionProjects.length ? (
                expeditionProjects.map((project, index) => {
                  const checked = completedExpeditionSet.has(project.slug);
                  return (
                    <div
                      key={project.slug}
                      className={cn(
                        "flex items-center justify-between gap-3 border px-3 py-2",
                        checked
                          ? "border-accent/80 bg-panel2/40"
                          : "border-frame2/70 bg-panel2/20"
                      )}
                      data-testid={`expedition-option-${project.slug}`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text">
                        {project.name}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        aria-label={`${project.name} ${
                          checked ? labels.completeLabel : labels.inactiveLabel
                        }`}
                        className={cn(
                          "relative h-5 w-9 shrink-0 rounded-full border transition",
                          checked
                            ? "border-accent/80 bg-accent/20"
                            : "border-frame2/80 bg-panel hover:border-accent/70"
                        )}
                        data-testid={`expedition-completed-toggle-${project.slug}`}
                        onClick={() => updateCompletedFromIndex(index, !checked)}
                        disabled={savingExpedition || loadingExpedition}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border transition",
                            checked
                              ? "left-[18px] border-accent bg-accent/90"
                              : "left-[2px] border-frame2/80 bg-frame2"
                          )}
                        />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="hud-empty-state flex h-8 items-center px-3 py-0 text-[10px] tracking-[0.16em]">
                  {labels.noExpeditionsFound}
                </div>
              )}
            </div>
            {expeditionErrorKey ? (
              <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-warn">
                {labels[expeditionErrorKey]}
              </div>
            ) : null}
          </div>
          <div className="border-t border-frame2 pt-4">
            <ExpeditionPauseNotice />
            <div className="hud-label">{labels.expeditionResetLabel}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                className="px-3"
                disabled={projectsLoading || loadingExpedition || !activeExpeditionSlug || resetAlreadyRecorded}
                data-testid="operator-expedition-reset-open"
                onClick={() => setResetDialogOpen(true)}
              >
                {resetAlreadyRecorded ? labels.expeditionResetRecorded : labels.expeditionResetCta}
              </Button>
            </div>
          </div>
          <div className="border-t border-frame2 pt-4">
            <div className="flex items-center justify-between">
              <span className="hud-label">{labels.expeditionReady}</span>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  clearIdentity();
                }}
                className="px-3"
                data-testid="operator-logout"
              >
                {labels.logOut}
              </Button>
            </div>
          </div>
        </div>
      </Panel>
      {resetDialogOpen ? (
        <ExpeditionResetDialog
          onClose={() => setResetDialogOpen(false)}
          onConfirmReset={async () => {
            const success = await resetProgress();
            if (success) {
              setResetDialogOpen(false);
            }
            return success;
          }}
          loading={savingReset}
          error={resetErrorKey ? labels[resetErrorKey] : ""}
        />
      ) : null}
    </div>
  );
}
