# Frozen Trail data (8 October 2026)

Reviewed local overrides extend the pinned RaidTheory dataset. No live API calls
are needed to display the imported content.

Sources:

- [Embark 2.0 patch notes](https://arcraiders.com/news/frozen-trail-2-0-update)
- [ARC Tracker public API documentation](https://arctracker.io/developers/docs)
- [Items](https://arctracker.io/api/items), [projects](https://arctracker.io/api/projects),
  and [hideout](https://arctracker.io/api/hideout), generated 2026-10-08 15:13:51 UTC.
- Item assets: the `imageFilename` URLs supplied by ARC Tracker's item API,
  copied into `data/arc-overrides/images/items`. Game content belongs to Embark.

Imported scope:

- Eight 2.0 blueprints (Advanced Camera, Banjo, Bantam, Emperor Gateway Conduit,
  Grappling Hook, Stiletto, Tether Launcher, Yank Grenade). Banjo is a Collector
  DLC blueprint; being listed in the tracker does not imply a Topside drop.
- `sheltered_retreat_project`: photo objective, four material requirements,
  construction-site objective. Its photo instruction is clarified using Embark's
  patch notes. The project is also linked from Hideout, using the same progress.
- `research_station`: four levels, twelve material requirements, and the
  Outpost room-count prerequisites supplied by the API.
- Thirteen missing requirement items, plus the eight blueprint items, with
  German/English names and local images. Existing item and progress IDs remain
  unchanged. Stash data is not updated.

Objectives use stable namespaced `objective:<project>:<source category>` IDs
and the existing per-user quantity persistence (0/1). The loader marks them as
objectives; progress responses expose `itemType: Objective`. They are rendered
as checkboxes and excluded from community/public material needs and compact
missing-material summaries. No database migration is needed.

Known limits:

- Outpost room expansion costs are absent from these API responses. Room-count
  prerequisites are displayed as guidance, not enforced against guessed room
  progress. Separate expansion tracking awaits verified requirements.
- The construction-site objective tracks completion of the game objective as a
  whole; the source does not provide its individual combat counters.
- Furniture Designs and Stencils are separate learned collections (see below).
  Research items are not treated as Blueprints.

Validation: `tests/frozen-trail.spec.ts` exercises blueprint/material/objective
persistence, research prerequisites, image availability, mobile layout, and
exclusion of objectives from shared and public needs. Screenshots are written
under `test-results/`.

## Learned collections

The collection screen at `/blueprints` now has separate tabs for Blueprints,
100 furniture Designs, and 14 weapon Stencils. The latter two are imported from
the same October 8 item snapshot, with German/English names and local images.
Only unlock status is tracked, with quantity 0/1; no crafting or research costs
are imported. The user explicitly requested learning status only.

The existing `blueprints` slug, stage order and item IDs remain stable. The new
`furniture_designs` and `weapon_stencils` slugs reuse per-user progress persistence
with `kind: collection`. They do not enter the normal project/hideout lists.
Each tab has independent search and missing-only storage keys; the selected tab
is remembered. Existing Blueprint filter keys are preserved.

The new cosmetic collections are excluded from the existing expedition reset,
which still resets workshop and Blueprint progress only. Premium/DLC rewards
are included in the catalogue; being listed does not imply that every entry can
be looted Topside.

`tests/collections.spec.ts` covers separate categories, counts, learned status
across reloads, preservation of existing Blueprint progress, independent filters,
and screenshots on desktop/mobile.

## Image research (October 8, 2026)

MetaForge's public item API (`https://metaforge.app/api/arc-raiders/items`) returns
100 Designs with 100 distinct image URLs when queried with `search=Design&limit=150`.
Unlike ARC Tracker's generic Design documents, visually checked examples show
the actual furniture: Alpine Wardrobe and Bar Table. MetaForge's Design IDs map
to our IDs by replacing hyphens with underscores; match against our catalogue,
rather than importing MetaForge names or rarity values wholesale.

The query `search=Stencil&limit=150` returns 14 Stencils plus Stencil Parts.
Eight Stencils have individual, visually verified pattern-book icons: Cerulean,
Dusty Camo, Garnet, Milky Terraccota (source spelling), Ochre, Slipstream,
Tortoise, and Verdigris. Bulwark, Dragon's Breath, Empyrean, Fortuna, Sacrifice,
and Serac share a generic Blueprint image. These icons show pattern books,
not the finish applied to a weapon. No complete, reliably labelled set of
weapon previews was found. A Reddit showcase exists but does not provide a
verified item-by-item asset mapping.

Before adopting MetaForge images, retain the existing learned-item IDs and
progress, add source attribution/link as required by their API terms, and cache
assets locally. Public API documentation: https://metaforge.app/arc-raiders/api.
Example pages:
- https://metaforge.app/arc-raiders/database/item/alpine-wardrobe-design
- https://metaforge.app/arc-raiders/database/item/bar-table-design

The collection now uses all 100 MetaForge furniture previews and the eight
individual Stencil icons, stored locally. The remaining six Stencils retain
their original icons. Item IDs and learned progress remain unchanged.
`data/arc-overrides/collection-image-sources.json` records the source URL and
SHA-256 of each imported image. New `_metaforge.png` filenames avoid stale
images from the image route's immutable browser cache. A MetaForge attribution
link appears below the furniture and Stencil collections in both languages.
Two ambiguous Study Armchair names are matched by source asset ID:
`study-armchair-design-res-armchair-01-a` → `study_armchair_design` and
`study-armchair-design-res-sofa-01-y150-a` → `res_sofa_01_y150_a_design`.

Deployment review: the existing Docker image copies `data/` into the runtime;
the image API's file tracing also includes the override images. No new
environment variables, dependencies, or database migrations are required.
Project/item records are added by the existing transactional synchronization.
Full Playwright coverage was exercised, including the normally skipped final
expedition departure test in a separate pause-date run. Two stale Script test
expectations were aligned with existing behavior (`Item:` prefix and `Prüfer`).
