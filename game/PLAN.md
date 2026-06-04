# Rikizo — Godot 4.4 Game Plan

> A JRPG played entirely in Japanese where the world materializes as the player learns. Built in Godot 4.4, targeting iOS/Android.

---

## Current State

- **Engine:** Godot 4.4
- **Working:** Day 1 proof-of-concept — Rikizo's house with Mom, Dad, collision map, dialogue overlay, term processor, basic NPC interaction
- **Assets in place:**
  - Day 1: map, collision, 3 conversation backgrounds (kitchen, living, void), character sprites + portraits (Rikizo, Mom/Sakura, Dad/Taro + alt portraits), door sprite, player sprite sheet
  - **GuttyKreum interior tileset** (`house_interior.png`) — 2336x704px, 73×22 grid, 32x32px tiles. Fully cataloged in `TILE_CATALOG.md`. Includes floors, 3D perspective walls, furniture, kitchen, bathroom, electronics, decorative items, autotile wall systems
  - **700+ reference tiles** (GK_HI_A/B/C/D series) in `assets/shared/tiles_reference/`
  - Godot TileSet resource (`house_interior.tres`) configured for the tileset
- **Scripts:** GameManager (autoload), DayLoader, DialogueOverlay, InteractiveObject, Player, NPC, CollisionMap, TermProcessor, TouchControls
- **Data:** day.json structure, glossary, conjugation rules, character data, particles
- **Missing:** Most of MIGRATION_PLAN.md phases (backgrounds in dialogue, portrait overrides, scripted events, trackers, touch controls)

---

## Development Phases

### Phase 0 — Complete Day 1 Migration (from MIGRATION_PLAN.md)

Finish porting Game.js → Godot for Day 1 parity. See `MIGRATION_PLAN.md` for detailed tasks:

1. **Asset pipeline fix** — update `setup_assets.sh` for current asset names
2. **Per-NPC conversation backgrounds** — DialogueOverlay shows background texture per NPC
3. **Portrait override system** — alt portraits per conversation (shocked Rikizo, angry Dad)
4. **Scripted events** — front door void scene, toilet/bath door scene, post-void parent conversations
5. **Door collision improvements** — tighter collision, push-out logic
6. **Tracking systems** — paranoia, relationships, annoyance scaffolding + save/load
7. **Touch controls** — D-pad + interact button for mobile
8. **Cleanup & polish** — full Day 1 flow test

### Phase 1 — Day System & Progression

Build the infrastructure to support 18 game days that unlock via lesson completion.

- [ ] **Day unlock system** — completing a lesson (N5.X) unlocks Day X
- [ ] **Day transition** — end-of-day trigger (bed interaction) → save → advance to next day
- [ ] **DayLoader generalization** — load any `day-XX-slug/day.json` dynamically
- [ ] **Manifest integration** — read from `manifest.json` to know which days exist and are unlocked
- [ ] **Save system** — persist current day, trackers, flags, relationships to `user://save_data.json`
- [ ] **Day-over-day world changes** — NPCs remember previous days, void boundary recedes, new objects appear

### Phase 2 — Core Game Systems

Systems that span all days and define the gameplay loop.

- [ ] **Inventory system** (Day 2+) — collect items, view inventory, use items
- [ ] **Currency system** (Day 3+) — earn yen from lessons/dojo, spend at shops
- [ ] **Quest log** (Day 2+) — track incomplete quests (e.g., ◻ 水を＿＿), show completion
- [ ] **Shop system** (Day 8+) — browse items, buy with yen, shopkeeper NPC interactions
- [ ] **Phone system** (Day 4+) — messages, contacts list, clock, wallet; grows each day
- [ ] **Relationship tracker** — hidden stats (paranoia, curiosity, relationships, annoyance) with no visible numbers; affects dialogue and endings
- [ ] **Calendar** — in-game date tracking (April 27 → May 5+), Golden Week awareness

### Phase 3 — Art Asset Production

#### Existing Assets (no generation needed)
- **Interior tilesets:** GuttyKreum tileset covers all interior needs — floors (wood, brick, tatami, tile), 3D walls (cream, dark wood, shoji), furniture, kitchen, bathroom, electronics, decorative items. See `TILE_CATALOG.md` for full inventory.
- **Reference tiles:** 700+ individual tile PNGs (GK_HI_A/B/C/D) for additional variety
- **Day 1 characters:** Rikizo, Mom, Dad sprites + conversation portraits + alts

#### PixelLab MCP — Character Sprites
Use `create_character` + `animate_character` for new NPCs as they appear:

| Character | Day | Description | Notes |
|-----------|-----|-------------|-------|
| **木-さん (Tree-san)** | 2 | Tree with face/personality | Static sprite, secret character |
| **やまかわ** | 5 | Best friend, casual clothes | Variant: holding onigiri (Days 5-7) |
| **Shopkeeper** | 5 | Konbini staff, apron | Static behind counter |
| **ゆき** | 11 | Nature lover, outdoor clothes | — |
| **すずき先生** | 12 | Teacher, glasses, cardigan | — |
| **けん / リー / ミキ** | 12 | Classmates, school uniforms | 3 characters |
| **レン** | 17 | Worker, changes outfits | Multiple variants |
| **ナナ** | 18 | Recorder girl, notebook | — |
| **忘れ人 Minions** | mid-game | Shadowy, glitch-like, distorted | Enemy sprites |

PixelLab params: `proportions: chibi`, `size: 48`, `n_directions: 4`, `body_type: humanoid`

#### PixelLab MCP — Exterior Tilesets
Interior tiles are covered by GuttyKreum. Exterior tilesets needed from Day 5+:

| Tileset | Day | PixelLab Tool | Notes |
|---------|-----|---------------|-------|
| Grass/dirt path | 2 | `create_topdown_tileset` | Yard around house |
| Road/sidewalk | 5 | `create_topdown_tileset` | Town streets |
| River/water | 6 | `create_topdown_tileset` | Chain with grass via `lower_base_tile_id` |
| School exterior | 12 | `create_topdown_tileset` | Courtyard, paths |
| Void-edge terrain | 2+ | `create_topdown_tileset` | Grass → void transition |

PixelLab params: `view: "low top-down"`, `tile_size: 32` (match GuttyKreum)

#### PixelLab MCP — Map Objects
Use `create_map_object` for items not in the GuttyKreum set:

| Object | Day | Notes |
|--------|-----|-------|
| Outdoor tree (generic) | 2 | Yard, neighborhood |
| Tree-san (face tree) | 2 | Special character object |
| Vending machine | 5 | Town/neighborhood |
| Street signs (Japanese) | 5 | With correct kanji |
| Power lines | 5 | Neighborhood scenery |
| Train station platform | 5 | 駅 exterior |
| Dad's car | 6 | Parked in front of house |
| River bridge | 6 | Cross the river |
| School building facade | 12 | Exterior view |
| Shrine/torii gate | later | Spiritual location |

#### Conversation Portraits (Mode B — Mob Psycho 100 style)
Generated via Gemini API / art pipeline (see `RikizoArtPipeline.md`):
- Each NPC needs calm set (dot eyes, simple) + intense set (full expressive)
- Conversation backgrounds per location (kitchen, living room, void, konbini, station, school, etc.)

### Phase 4 — Build Days 2–9 (Early Game)

Each day = new `day-XX-slug/` directory with `day.json`, map, collision, NPC sprites/portraits.

| Day | Slug | Key Content | New Systems | New NPCs |
|-----|------|-------------|-------------|----------|
| 2 | `day-02-elements` | Yard appears, tree, sun, gold coin, water | Inventory, quest log | 木-さん |
| 3 | `day-03-numbers` | Currency activates, Dad pays 2000 yen | Currency system | — |
| 4 | `day-04-time` | Phone returned, clock works, cake gag | Phone system | — |
| 5 | `day-05-going` | Town expands — konbini, station, road | Verb conjugation in dialogue | やまかわ |
| 6 | `day-06-landscape` | Mountains, river, Dad's car | Email system, car gag | — |
| 7 | `day-07-hunger` | 食べる/飲む unlock, cake eaten, onigiri eaten | Food mechanics | — |
| 8 | `day-08-commerce` | Shop functional, buy onigiri | Shop system | Shopkeeper |
| 9 | `day-09-inside` | 中/外 unlock — buildings have interiors, fridge opens | Interior expansion | — |

**Per-day production checklist:**
1. Write `day.json` (NPCs, objects, conversations, flags, quests)
2. Build map using GuttyKreum tileset (interiors) + PixelLab tilesets (exteriors) via Godot TileMap
3. Paint collision map (red=wall, blue=interactive)
4. Generate/reuse NPC sprites and portraits
5. Generate conversation backgrounds per new location
6. Write scripted events and flag logic
7. Test full day flow
8. Update manifest

### Phase 5 — Build Days 10–18 (Mid Game)

| Day | Slug | Key Content | Major Feature |
|-----|------|-------------|---------------|
| 10 | `day-10-weather` | Weather system, casual speech begins, electricity | Register system (polite→casual) |
| 11 | `day-11-sky` | Night cycle, rain, nature deepens | Weather rendering |
| 12 | `day-12-school` | **School appears** — classroom, hallways, rooftop | School map, 4+ new NPCs |
| 13 | `day-13-communication` | Phone texts/calls expand | Message UI |
| 14 | `day-14-quantity` | Inventory stacking, storage | Inventory expansion |
| 15 | `day-15-directions` | Map system, compass | Minimap/navigation |
| 16 | `day-16-vertical` | Upper/lower levels (stairs, rooftops) | Multi-layer maps |
| 17 | `day-17-work` | Job system, NPC daily routines | NPC scheduling |
| 18 | `day-18-body` | Body awareness, senses, final N5 expansion | Sensory feedback |

### Phase 6 — Hidden Systems & Endings

- [ ] **Paranoia tracker** — void exploration, anomaly investigation (0–13+ scale)
- [ ] **Curiosity tracker** — thorough exploration rewards (0–13+ scale)
- [ ] **Relationship thresholds** — dialogue changes at milestones
- [ ] **Dad annoyance** — toilet door, gold coin, car touching; cools -1/night; locks quest at sustained ≥9
- [ ] **Tree-san relationship** — daily greeting required for best ending (need 15+ by Day 18)
- [ ] **"いつも" system** — NPCs claim new things "always" existed; memory rewriting
- [ ] **Running gags** — toilet door (all days), Dad's gold (all days), Dad's car (Day 6+), Mom's cake (Days 4-7)

#### Endings (determined by Day 18 stats)
1. **Tree-san Saves the Day** — `char_tree >= 15` + `befriended_day2`
2. **Awakened** — `paranoia >= 13`
3. **Explorer** — `curiosity >= 13`
4. **Family** — `char_taro >= 12 AND char_sakura >= 12`
5. **Standard** — default fallback

### Phase 7 — Combat System (N4+)

- [ ] Turn-based battle system (Mode A pixel sprites)
- [ ] 忘れ人 minion encounters — shadowy enemies near world-rebuild zones
- [ ] Party system — recruit classmates
- [ ] Magic/abilities unlock via Compose module completion
- [ ] Boss fights against 忘れ人
- [ ] Battle sprites: idle, attack, hurt, victory animations via PixelLab `animate_character`

### Phase 8 — Polish & Ship

- [ ] **Audio** — BGM per location, SFX for interactions, ambient sounds
- [ ] **Transitions** — fade between days, screen effects for void encounters
- [ ] **Localization hooks** — all game text from JSON (already in place via term system)
- [ ] **Performance** — asset streaming for mobile, memory management
- [ ] **iOS/Android export** — Godot export templates, app store prep
- [ ] **Accessibility** — text size options, touch target sizing
- [ ] **Tutorial** — subtle first-day guidance without breaking immersion

---

## PixelLab MCP Quick Reference

| Tool | Use Case | Key Params |
|------|----------|------------|
| `create_character` | NPC/player sprites | `description`, `proportions` (chibi), `n_directions` (4), `size` (48), `body_type` (humanoid) |
| `animate_character` | Walk cycles, idle, battle | `character_id`, `template_animation_id`, `action_description`, `directions` |
| `get_character` | Download sprite sheets | `character_id` → ZIP with all frames |
| `create_topdown_tileset` | **Exterior** terrain only | `lower/upper_description`, `tile_size` (32), `view` ("low top-down"), chain via `lower_base_tile_id` |
| `create_map_object` | Outdoor props, vehicles, signs | `description`, `width`, `height`, `view` |

**Not needed:**
- `create_sidescroller_tileset` — top-down game
- `create_isometric_tile` — top-down game
- Interior tilesets — covered by GuttyKreum

---

## Architecture

```
godot/
├── project.godot
├── scenes/
│   ├── main.tscn                    # Main game scene
│   ├── npc.tscn                     # NPC template
│   ├── interactive_object.tscn      # Interactable object template
│   └── touch_controls.tscn          # Mobile controls
├── scripts/
│   ├── GameManager.gd               # Autoload — state, trackers, save/load
│   ├── DayLoader.gd                 # Loads day.json → spawns map, NPCs, objects
│   ├── DialogueOverlay.gd           # Speech bubble + portrait + background
│   ├── InteractiveObject.gd         # Clickable/interactable world objects
│   ├── NPC.gd                       # NPC sprite + conversation trigger
│   ├── Player.gd                    # Movement, interaction detection
│   ├── CollisionMap.gd              # Red=wall, blue=interactive zone
│   ├── TermProcessor.gd             # Japanese term → clickable chip
│   └── TouchControls.gd             # Mobile D-pad + interact button
├── assets/
│   ├── backgrounds/                 # Conversation backgrounds (kitchen, living, void)
│   ├── data/                        # JSON data (glossary, rules, characters)
│   ├── days/
│   │   ├── day-01-home/             # Day 1 (working)
│   │   │   ├── day.json
│   │   │   ├── map.png / collision.png
│   │   │   └── characters/          # Sprites + portraits
│   │   ├── day-02-elements/         # (to build)
│   │   └── ...
│   ├── shared/
│   │   ├── sprites/                 # Player sheet (me_sheet.png), door
│   │   ├── tilesets/
│   │   │   ├── house_interior.png   # GuttyKreum 2336x704, 73×22 @ 32x32
│   │   │   ├── house_interior.tres  # Godot TileSet resource
│   │   │   └── TILE_CATALOG.md      # Full tile inventory
│   │   ├── tiles_reference/         # 700+ individual tile PNGs (GK_HI_A/B/C/D)
│   │   └── objects/                 # Map objects (empty, to populate)
│   └── ui/                          # UI elements
├── PLAN.md                          # ← this file
├── MIGRATION_PLAN.md                # Day 1 migration tasks (Phase 0)
├── SETUP.md                         # Setup instructions
└── setup_assets.sh                  # Asset copy script
```

---

## Design Principles

1. **Vocabulary = Existence** — if a word isn't taught, its concept doesn't exist in the game world
2. **Invisible consequences** — no visible stat numbers; effects show through dialogue changes and story outcomes
3. **No missable critical content** — all endings and quests are bonus; base game always completable
4. **Curiosity rewarded** — opening the front door, befriending the tree, exploring thoroughly → unique content
5. **Comedy + cosmic horror** — NPCs are absurdly oblivious while reality literally rebuilds around them
6. **Progressive density** — early days are sparse and eerie; later days are full and lively
7. **All Japanese, all the time** — every piece of text is Japanese with clickable term links

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-07 | Initial plan — 8 phases, 18-day structure, PixelLab for characters + exteriors only, GuttyKreum for interiors |
