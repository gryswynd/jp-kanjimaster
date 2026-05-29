# Phone Cases — Gachapon Collection System

**Status:** Planning. Vending machine sprite + placement done (day-09-konbini-gacha). Blank-phone assets pending.

## What this is

The Special_Vending machine at `day-09-konbini-gacha` (cylindrical red gachapon with one capsule visible at a time) sells **phone cases**. Each case is a one-time, story-gated item: when it appears in the dome, the player can buy it for ¥10,000; once collected, the case becomes equippable from the inventory.

Cases shipped will accumulate over the story. The gachapon company eventually shuts down later in the story (TBD beat), at which point no new cases appear and the machine becomes inactive / decorative.

## Architecture

**Each case = a full phone sprite (no overlay compositing).**

When the player equips a case, the swap is a sprite swap: every UI surface that draws the phone (HUD icon, tap-to-pay overlay, any conversation CG) reads the equipped case's sprite paths and draws those. No render-time layering. This matches how the existing tree-san phone already works (the charm is baked into the sprite, not overlaid).

Two sprites per case:
- `<case_id>_small.png` — ~64×64, used as the day-01 phone-on-table object icon and the HUD inventory tile
- `<case_id>_large.png` — ~1024×1024, used by `TapToPayOverlay.gd` and any case-prominent conversation

The equipped case ID is stored in save data (TBD field, e.g. `inventory.equipped_phone_case`). On load, the renderer resolves the ID to the two sprite paths.

## Case catalog

| Case id | Body color | Charm | Source | Availability gate |
|---|---|---|---|---|
| `blank` | clean white iPhone-style | none | base asset (to generate) | always equipped if no case owned |
| `tree_san` | green | small pine tree | existing assets at `day-01-home/objects/sumaho.png` + `ui/tap_to_pay/sumaho_large.png` | owned only if player befriends tree-san by end of day 3. **Forfeit forever** after that deadline if not befriended. |
| `red_promo` | red | gachapon-company logo charm (logo TBD) | to generate | first item in the gachapon dome at day 9 / earliest gachapon visit. ¥10,000. |
| _future cases_ | various | various | TBD | tied to story beats |

**Tree-san special case**: The existing green-with-tree phone IS already in the codebase as the "default" phone Rikizo carries. Under the new system, this becomes a conditional case. If the player doesn't befriend tree-san by end of day 3, the phone reverts to the `blank` case and the tree-san case is removed from inventory permanently (can't get it back via the gachapon — it was a story-gated one-shot, never sold).

## Gachapon company shutdown

At a later story beat (TBD), the gachapon company is shuttered. Visible effects:
- The Special_Vending dome shows nothing or shows "closed" signage
- Interacting with the machine produces a "no longer in service" message
- No new cases can be obtained
- Cases already in the inventory are still equippable

This is a one-way state transition — no reactivation.

## Game-loop surfaces affected

| Surface | Today | After this feature |
|---|---|---|
| Day-01 `sumaho.png` pickup | Hardcoded green tree phone | Renders the case currently equipped at game start (= tree-san if befriending arc is in play, else blank) |
| `TapToPayOverlay.gd` | Loads `sumaho_large.png` | Loads `<equipped_case>_large.png` |
| `PhoneOverlay.gd` / HUD inventory tile | Same | Same — driven by equipped case |
| Inventory UI | No case-swap UI exists | Add a "phone cases" inventory section showing owned cases; clicking equips. |
| Vending machine interaction | Decorative collision-on object | New interaction: opens a purchase prompt showing the currently-displayed case + price; "buy" deducts ¥10,000 and adds the case to inventory; dome can then be empty or rotate to the next available case. |
| Save data | No `equipped_phone_case` field | Add `inventory.equipped_phone_case` (case id) and `inventory.owned_phone_cases` (list of ids). Tree-san eligibility window tracked separately (e.g. `flags.tree_san_befriended`, `flags.tree_san_window_expired`). |

## Phased build plan

1. **Assets — base + first promo case.** Generate `blank_small`, `blank_large`, `red_promo_small`, `red_promo_large`. Use Gemini image-edit on existing tree-san phones for `blank` (remove charm, recolor green→white). Generate `red_promo` from scratch via a sprite config (or as an edit on `blank` once it exists).
2. **Data layer.** Define case-id → sprite-path lookup. Add `inventory.equipped_phone_case` + `inventory.owned_phone_cases` to save schema. Migrate existing saves: if green-tree phone is owned → `equipped = tree_san`, `owned = [tree_san]`; else `equipped = blank`.
3. **Rendering swap.** Update `TapToPayOverlay.gd`, day-01 pickup, HUD/inventory tile, any other phone sprite consumer to read from the equipped case.
4. **Inventory case-swap UI.** Add a phone-cases section to whatever inventory overlay exists; clicking equips.
5. **Vending machine interaction.** Special_Vending becomes interactive; opens a purchase prompt; buy deducts ¥10,000 and adds the displayed case. Empty / "no items" state when dome is empty.
6. **Tree-san gating.** Add the day-3 deadline logic — if `flags.tree_san_befriended` is false at end-of-day-3, remove tree-san from inventory and set `flags.tree_san_window_expired = true`.
7. **Company shutdown.** Story-beat-gated state: when triggered, vending machine becomes inactive, dome shows "closed", interaction produces a closure message.

## Open questions

- **Logo design** for the gachapon company (used as the charm on `red_promo` and visible on the machine front in future renders). Currently the machine has no brand mark. TBD.
- **What happens to ¥10,000 if player doesn't have it?** Probably: cannot interact / button greyed out. Confirm.
- **Inventory UI**: does one exist already, or build new? `InventoryOverlay.gd` exists — check what it currently shows.
- **Dome content state**: does the dome ALWAYS show the next available case, or is it sometimes empty between story beats? Likely: shows the currently-available case if any, otherwise empty/dim.
- **Tree-san befriending mechanism**: confirm where the friendship flag gets set (which interaction on day 1-3 triggers `flags.tree_san_befriended = true`).

## Assets — file paths

When generated, sprites land at:
- `godot/assets/phone_cases/blank/sumaho_small.png` + `sumaho_large.png`
- `godot/assets/phone_cases/red_promo/sumaho_small.png` + `sumaho_large.png`
- `godot/assets/phone_cases/tree_san/sumaho_small.png` + `sumaho_large.png` (move existing assets here)

Refactoring the tree-san sprites out of `day-01-home/objects/` and `ui/tap_to_pay/` into the per-case structure is part of Phase 2/3, not Phase 1.
