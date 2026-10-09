# Research, furniture and Outpost costs

Snapshot checked on 2026-10-09:

- https://arctracker.io/research — 59 blueprint research recipes and 52 design recipes.
- https://arctracker.io/outposts — 100 furniture crafting recipes and 53 design research recipes. The additional research recipe is `battered_aviary_table_design`; it is included in `collection-costs.json`. The other 52 match the research page.
- https://arctracker.io/outposts/panoramic_room
- https://arctracker.io/outposts/timeless_room
- https://arctracker.io/outposts/chalet_room
- https://arctracker.io/outposts/studious_room

`collection-costs.json` keys use existing item IDs. Research costs are paid once to unlock a recipe; furniture crafting costs are per piece. A null research entry explicitly means not researchable. Missing entries mean unverified, never zero/free. Costs are informational and do not add progress records or community needs.

`projects.json` includes all six stages of `sheltered_retreat_project`: three unlock stages followed by rooms 2–4 (phases 4–6). Costs depend on installed room count. Panoramic/Timeless/Chalet have all three price tiers; Studious is listed only at room 4. Room styles are informational. On sync, legacy `outpost` expansion stages move into this project with saved progress retained; duplicate progress takes the larger quantity, never the sum.

The six added expansion material icons come from MetaForge's public item API (`https://metaforge.app/api/arc-raiders/items`) and are stored locally. Game content and images belong to Embark Studios.
