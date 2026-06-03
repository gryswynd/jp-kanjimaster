# Godot Migration Plan: Game Day System

> **Goal:** Bring the Godot project to full parity with Game.js (Day 1), scaffold tracking systems, and prepare for Day 2+ development natively in Godot.

---

## Phase 1: Asset Pipeline Fix

**Problem:** `setup_assets.sh` is stale — doesn't know about renamed/new assets.

### Tasks:
- [ ] Update `setup_assets.sh` to copy all current backgrounds:
  - `convo-bg-kitchen.png` (was `convo_bg.png`)
  - `convo-bg-living.png`
  - `convo-bg-void.png`
- [ ] Copy alt portraits:
  - `rikizo-convo-shocked.png`
  - `taro-convo-angry.png` (once uploaded)
- [ ] Copy door sprite from `shared/sprites/door.png`
- [ ] Update day.json copy to reflect current structure (`convoBackgrounds` map, `altPortraits`)
- [ ] Make script idempotent (clean + recopy)

---

## Phase 2: Per-NPC Conversation Backgrounds

**Current Godot state:** DialogueOverlay has no background image — just a black overlay.
**Game.js state:** Each NPC has a `convoBackground` key pointing into `assets.convoBackgrounds`.

### Tasks:
- [ ] Update `DialogueOverlay.gd` to accept and display a background texture
- [ ] Update `DayLoader.gd` to load all `convoBackgrounds` from day.json into a dictionary
- [ ] Pass background texture when starting conversations from NPC interactions
- [ ] Store loaded backgrounds in GameManager (keyed by name: kitchen, living, void)

---

## Phase 3: Portrait Override System

**Current Godot state:** Portrait is looked up by speaker name in `portrait_map`. One portrait per character.
**Game.js state:** `portraitOverrides` map can replace any speaker's portrait per-conversation.

### Tasks:
- [ ] Update `DayLoader.gd` to load `altPortraits` from day.json into GameManager
- [ ] Update `DialogueOverlay.gd` to accept `portrait_overrides` dictionary
- [ ] Per-line portrait resolution: check overrides first, fall back to portrait_map
- [ ] Clean up overrides when conversation ends

---

## Phase 4: Scripted Events

Port the three scripted interactions from Game.js.

### 4a: Front Door Void Scene
- [ ] In InteractiveObject.gd or DayLoader.gd, detect `Front_Door` interaction
- [ ] Trigger conversation with void background + shocked Rikizo portrait
- [ ] On conversation end: close door, mark as disabled (no further interaction)
- [ ] Set `void_seen = true` flag in GameManager

### 4b: Toilet / Bath Door Scene
- [ ] Detect `Toilet` interaction when `Bath_Door` is open
- [ ] Trigger angry dad conversation with living room background
- [ ] Use `alt_dadAngry` portrait override for dad's lines

### 4c: Post-Void Parent Conversations
- [ ] Track `void_asked` per NPC in GameManager
- [ ] When `void_seen` is true and NPC hasn't been asked yet, swap in one-time conversation:
  - Mom: shocked Rikizo tries to explain, mom brushes off → "be a good teacher"
  - Dad: shocked Rikizo tries to explain, dad brushes off → "you're a teacher"
- [ ] After one-time conversation plays, subsequent talks use normal conversation

---

## Phase 5: Door Collision Improvements

### Tasks:
- [ ] Shrink door collision to match Game.js fix (tight padding instead of full object bounds)
- [ ] Add push-out logic: if door closes while player overlaps, nudge player to nearest side
- [ ] Disable door interaction label for disabled doors (Front_Door after void scene)

---

## Phase 6: Tracking Systems (Scaffold)

**Purpose:** Record Day 1 events for future gameplay effects in Day 2+. Storage and increment only — no rules or branching yet.

### Data Model:
```gdscript
# GameManager additions
var trackers := {
    "paranoia": 0,       # Rikizo's awareness that something is wrong
    "relationships": {},  # Per-NPC: { "mom": 0, "dad": 0 }
    "annoyance": {}       # Per-NPC: { "dad": 0 }
}
```

### Day 1 Events That Increment:
| Event | Tracker | Delta | Notes |
|-------|---------|-------|-------|
| Open front door (void scene) | paranoia | +2 | Big discovery |
| Ask mom about void | paranoia | +1 | She ignores it — unsettling |
| Ask dad about void | paranoia | +1 | He ignores it too |
| Talk to mom (normal) | relationships.mom | +1 | Bonding |
| Talk to dad (normal) | relationships.dad | +1 | Bonding |
| Toilet with door open | annoyance.dad | +1 | Dad is annoyed |

### Tasks:
- [ ] Add `trackers` dictionary to GameManager
- [ ] Implement `increment_tracker(category, key, delta)` helper
- [ ] Hook Day 1 events to call `increment_tracker`
- [ ] Implement save/load to `user://save_data.json` using Godot FileAccess
- [ ] Auto-save after each tracker change
- [ ] Load on startup (with defaults if no save file)

### Deferred to Day 2:
- Tracker thresholds and effects (e.g., paranoia > 5 triggers new dialogue)
- NPC behavior changes based on relationship/annoyance
- UI indicators for tracker values (if any)
- Cross-day persistence and progression

---

## Phase 7: Touch Controls

**Current Godot state:** Keyboard only (WASD/arrows + Space/Enter).
**Game.js state:** D-pad buttons + interact button overlay for mobile.

### Tasks:
- [ ] Add touch D-pad scene (4 directional buttons)
- [ ] Add interact button
- [ ] Wire touch inputs to same actions as keyboard
- [ ] Auto-show on mobile/touch devices, hide on desktop
- [ ] Position overlay so it doesn't block game view

---

## Phase 8: Cleanup & Polish

- [ ] Remove stale `convo-bg.png` reference from setup_assets.sh
- [ ] Update SETUP.md to document new features
- [ ] Update campaign file (`campaigns/godot-migration.md`) status
- [ ] Test full Day 1 flow: wake up → explore → open front door → talk to parents → toilet scene

---

## Implementation Order

Recommended sequence (each phase builds on the previous):

```
Phase 1 (assets)
  → Phase 2 (backgrounds) + Phase 3 (portraits)  [parallel]
    → Phase 4 (scripted events)
      → Phase 5 (door collision)
      → Phase 6 (trackers)
    → Phase 7 (touch controls)  [independent]
  → Phase 8 (cleanup)
```

Phases 2+3 can run in parallel. Phase 7 is independent of everything except Phase 1.

---

## Files Modified

| File | Changes |
|------|---------|
| `setup_assets.sh` | New asset paths, cleanup |
| `scripts/GameManager.gd` | Trackers, void_seen, void_asked, convo backgrounds storage |
| `scripts/DayLoader.gd` | Load backgrounds, alt portraits, hook scripted events |
| `scripts/DialogueOverlay.gd` | Background texture, portrait overrides |
| `scripts/InteractiveObject.gd` | Door disable, push-out, front door special case |
| `scripts/Player.gd` | Minor: push-out support |
| `scenes/main.tscn` | Touch control nodes (Phase 7) |
| `SETUP.md` | Updated docs |
