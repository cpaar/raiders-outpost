"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FlaskConical, Hammer } from "lucide-react";
import { ItemTileMedia } from "@/components/items/ItemTileMedia";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLabels } from "@/components/locale/useLabels";
import { stripBlueprintLabel } from "@/lib/item-labels";
import type { CollectionCostMaterial } from "@/types/collection-costs";
import type { ProjectItemProgress } from "@/types/projects";

function CompactMaterials({ materials }: { materials: CollectionCostMaterial[] }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      {materials.map((material) => (
        <span key={material.itemId} className="inline-flex shrink-0 items-center gap-px"
          data-testid={`footer-material-${material.itemId}`}>
          <ItemTileMedia imageFile={material.imageFile} wrapperClassName="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
            imgClassName="h-full w-full object-contain" fallback={<span aria-hidden="true" className="text-muted">◇</span>} />
          <span aria-hidden="true" className="font-mono text-[9px] text-text">{material.quantity}</span>
          <span className="sr-only">{material.quantity}× {material.displayName}</span>
        </span>
      ))}
    </span>
  );
}

function MaterialCosts({ materials }: { materials: CollectionCostMaterial[] }) {
  return (
    <ul className="mt-1 space-y-1">
      {materials.map((material) => (
        <li key={material.itemId} className="flex items-center gap-2"
          data-testid={`cost-material-${material.itemId}`} data-required={material.quantity}>
          <span className="w-[5ch] shrink-0 font-mono text-accent">{material.quantity}×</span>
          <ItemTileMedia imageFile={material.imageFile}
            wrapperClassName="flex h-4 w-4 shrink-0 items-center justify-center"
            imgClassName="h-full w-full object-contain"
            fallback={<span aria-hidden="true" className="text-muted">◇</span>} />
          <span className="min-w-0">{material.displayName}</span>
        </li>
      ))}
    </ul>
  );
}

function CostTooltip({ item, id, anchorRef }: {
  item: ProjectItemProgress;
  id: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const labels = useLabels();
  const { locale } = useLocale();
  const research = item.costs?.research;
  const crafting = item.costs?.crafting;

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const tooltip = ref.current?.getBoundingClientRect();
      if (!tooltip) return;
      const below = bounds.bottom + 6;
      setPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - tooltip.width - 8)),
        top: Math.max(8, below + tooltip.height <= window.innerHeight - 8
          ? below : bounds.top - tooltip.height - 6),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  return createPortal(
    <div ref={ref} id={id} role="tooltip" data-testid="collection-cost-tooltip"
      style={position}
      className="pointer-events-none fixed z-[100] w-64 max-w-[calc(100vw-1rem)] border border-frame2 bg-panel p-3 text-xs text-text shadow-xl">
      <p className="mb-2 border-b border-frame2 pb-2 text-[11px] font-semibold uppercase tracking-wide">
        {stripBlueprintLabel(item.displayName)}
      </p>
      {research !== null ? <section data-testid="collection-research-costs">
        <h3 className="hud-label">{labels.researchCosts}</h3>
        {research ? (
          <>
            <p className="mt-1 flex items-center gap-2" data-testid="research-points">
              <span className="w-[5ch] shrink-0 font-mono text-accent">{research.points.toLocaleString(locale)}</span>{" "}
              <FlaskConical className="h-4 w-4 shrink-0 text-accent/70" aria-hidden="true" />
              <span className="min-w-0">{labels.researchPoints}</span>
            </p>
            <MaterialCosts materials={research.materials} />
            <p className="mt-2 text-[10px] text-muted" data-testid="research-station-level">
              {labels.researchStationLevel} {research.stationLevel}
            </p>
          </>
        ) : <p className="mt-1 text-muted">{labels.researchCostsUnknown}</p>}
      </section> : null}
      {item.itemType === "Design" ? (
        <section className={research !== null ? "mt-2 border-t border-frame2 pt-2" : ""} data-testid="collection-crafting-costs">
          <h3 className="hud-label">{labels.craftingCostsPerPiece}</h3>
          {crafting ? <MaterialCosts materials={crafting.materials} />
            : <p className="mt-1 text-muted">{labels.craftingCostsUnknown}</p>}
        </section>
      ) : null}
      <p className="mt-2 border-t border-frame2 pt-2 text-[10px] text-muted">{labels.costDataSource} ARC Tracker</p>
    </div>, document.body,
  );
}

export function CollectionItemCosts({ item }: { item: ProjectItemProgress }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const labels = useLabels();
  const { locale } = useLocale();
  const research = item.costs?.research;
  const crafting = item.costs?.crafting;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  return (
    <>
      <button ref={ref} type="button" data-testid={`collection-costs-${item.itemId}`}
        aria-label={`${labels.collectionCosts}: ${stripBlueprintLabel(item.displayName)}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
        className="-mt-px flex w-full flex-col rounded-b-[8px] border border-frame2 bg-panel2/80 px-1 py-0.5 text-left text-muted transition hover:border-accent/70 hover:bg-panel2 focus-visible:outline focus-visible:outline-accent">
        <span className="flex h-5 w-full items-center gap-1 whitespace-nowrap" data-testid="footer-research-summary">
          <FlaskConical className="h-3 w-3 shrink-0 text-accent/70" aria-hidden="true" />
          <span className="sr-only">{labels.researchCosts}: </span>
          <span className="shrink-0 font-mono text-[9px] text-accent">{research ? research.points.toLocaleString(locale) : "–"}</span>
          {research ? <CompactMaterials materials={research.materials} /> : null}
        </span>
        {item.itemType === "Design" ? (
          <span className="flex h-5 w-full items-center gap-1 border-t border-frame2/60" data-testid="footer-crafting-materials">
            <Hammer className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{labels.craftingCostsPerPiece}: </span>
            {crafting ? <CompactMaterials materials={crafting.materials} /> : <span className="font-mono text-[9px]">–</span>}
          </span>
        ) : null}
      </button>
      {open ? <CostTooltip item={item} id={tooltipId} anchorRef={ref} /> : null}
    </>
  );
}
