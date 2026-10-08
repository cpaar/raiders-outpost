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
- Furniture Designs, Stencils, and Research items are not automatically treated
  as Blueprints. Their unlock systems remain outside this import.

Validation: `tests/frozen-trail.spec.ts` exercises blueprint/material/objective
persistence, research prerequisites, image availability, mobile layout, and
exclusion of objectives from shared and public needs. Screenshots are written
under `test-results/`.
