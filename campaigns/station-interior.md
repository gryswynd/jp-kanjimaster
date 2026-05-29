# Station Interior — `day-09-station-inside`

**Status:** Planning. Chunk + collision pending. day.json + ekicho relocation + entrance/exit wiring follow.

## What this is

A new playable interior for the train station, distinct from the existing `day-05-station` (which is the outside platform/forecourt). The interior is a small rural Japanese eki ticket hall — quiet, a little dim, the only NPC inside is the **ekicho** behind a small ticket-counter window. Player enters via a sliding door from `day-05-station`; exits the same way.

Unlocks **day 9**. From day 9 onwards, ekicho appears INSIDE this scene rather than outside.

## Scope decisions (locked)

- **Layout**: classic small Japanese eki interior — ekicho window on the back wall, a row of ticket-vending machines on one side, decorative IC ticket-gates on the other side leading off-frame toward platforms (the platforms themselves are not built and won't be reachable). No bench painted into the chunk — benches are dropped as separate sprites later.
- **Purpose**: story-beat scene for talking to ekicho. Ticket machines + gates are flavor; no functional ticket-purchase loop yet. Could be added later as a separate feature.
- **Map mode**: painted PNG via Gemini, matching the existing project illustration style. Native 1920×1280, declared world 1248×832 (same convention as `day-05-konbini` and `day-09-konbini-gacha`).

## Visible features (painted into the chunk)

- **Top wall**: ticket-counter window with a wooden countertop. Above the window, a small green-and-white sign reading **みどりの窓口** in the style of JR ticket windows. Behind the window: soft-dim office interior (just enough to read as "there's a back room", not detailed).
- **Right wall**: two ticket-vending machines mounted side by side (clean grey-white cabinets with green touchscreen panels — the standard Japanese station ticket machine look).
- **Left wall**: a row of three IC ticket gates (Suica/Pasmo style — short waist-high turnstiles with green-striped tops). Gates lead off the left edge of the chunk toward where platforms would be (off-frame).
- **Bottom wall**: automatic sliding glass doors — the entrance from outside.
- **Floor**: cream / tan tile, subtle scuff/wear marks, slight downward camera tilt makes it dominate the lower half of the frame.
- **Lighting**: warm fluorescent overhead glow, soft cast shadows.

## NPCs / objects to place later (NOT in the chunk)

- **ekicho** — composited as an NPC sprite behind the ticket window, `appearsFromDay: 9`. Will need either a relocated reference (path to existing `day-05-station/characters/ekicho_*.png`) or fresh sprites for the station-inside scene.
- **Benches** — reuse existing `bench.png` sprite (the one used by `day-05-konbini`). Place a couple of them along the right and/or left wall via the positioner.
- **Exit_South** zone — invisible zone at the entrance door, transitions back to `day-05-station`.
- **Entrance objects on day-05-station** — add a `Station_Door` object on `day-05-station` that transitions IN to this scene (`appearsFromDay: 9`).

## Side effects on `day-05-station`

- **Ekicho relocation**: on day 9+, the existing `ekicho` NPC entry on `day-05-station` either changes its `appearsUntilDay: 8`, or we add a duplicate that ends at day 8 + the new entry inside that starts at day 9. Same trick as how yamakawa is duplicated in `day-05-konbini` (one entry `appearsUntilDay: 5`, another `appearsFromDay: 7`).
- **Entrance door**: new interactive zone on `day-05-station` at the front of the station building, `appearsFromDay: 9`, transitions into `day-09-station-inside`.

## File paths

- Chunk + collision: `output/_wip/maps/day-09-station-inside/chunks/0_0.png` + `0_0_collision.png` (then promoted via `deploy_assets.sh day-09-station-inside`).
- day.json: `godot/assets/days/day-09-station-inside/day.json` — modeled on `day-09-konbini-gacha`'s minimal shape.

## Build order

1. **Generate chunk** via Gemini using `day-09-konbini-inside/chunks/0_0.png` as a STYLE anchor (same painted-interior illustration hand, same lighting register).
2. **Generate / paint collision mask** — walls + ticket-machine bank + gates + counter blocked; floor + entrance gap passable.
3. **Write `day.json`** — playerStart near the entrance, Exit_South to day-05-station, ekicho NPC entry, bench objects.
4. **Patch `day-05-station/day.json`** — cap existing ekicho with `appearsUntilDay: 8`, add `Station_Door` interactive zone with `appearsFromDay: 9`.
5. **Wire transitions in `DayLoader.gd`** — handle the new Station_Door object name to transition into `day-09-station-inside`.
6. **Positioner** for fine-tuning bench + ekicho positions.

## Open questions (not blocking)

- Does the player NEED to enter the station for any specific lesson/quest? Or is this purely flavor + the ekicho convo? Determines whether we need conversation extensions, quest hooks, etc.
- Future train-travel mechanic — likely a separate campaign; this interior is the staging ground for it.
- If the existing ekicho sprite reads poorly inside (different lighting register from outside), we may need a tinted variant. Defer until we see it composited.
