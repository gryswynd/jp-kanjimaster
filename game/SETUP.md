# Rikizo Game — Godot Port

## What this is

The native Godot 4 version of the Rikizo game day system. Day 01 (House Adventure) is fully ported from the browser canvas game, and future days will be built directly in Godot.

## What works

- Rikizo walks around the house with 4-direction animated sprite
- Pixel-based collision from `collision.png` (red = walls)
- Camera follows the player with smooth scrolling
- NPC interaction: walk up to Mom or Dad, press Space/Enter to talk
- Per-NPC conversation backgrounds (kitchen for Mom, living room for Dad)
- Portrait overrides per conversation (shocked Rikizo, angry Dad)
- Full conversation overlay with portraits and background images
- Vocab term tagging in dialogue (tappable words in BBCode)
- Interactive objects: beds, doors, kotatsu, laptop, etc.
- Door open/close with collision toggling + push-out on close
- "???" → name reveal on first inspection
- All data loaded from the existing `day.json` format

### Scripted events
- **Front door void scene:** Opening the front door shows a void background with shocked Rikizo. Door locks after.
- **Post-void parent conversations:** After the void scene, Mom and Dad each have a one-time conversation where Rikizo tries to tell them but they brush him off.
- **Toilet scene:** Using the toilet with the bathroom door open triggers angry Dad yelling.

### Tracking systems
- **Paranoia:** Incremented by void scene (+2) and parent brush-offs (+1 each)
- **Relationships:** Incremented by normal NPC conversations (+1)
- **Annoyance:** Incremented by toilet scene (+1 to dad)
- All trackers saved to `user://save_data.json`

## Quick start

### 1. Install Godot 4.3+

Download from [godotengine.org/download](https://godotengine.org/download). It's a single executable — no installer needed.

### 2. Copy assets into the Godot project

From the repo root:

```bash
bash godot/setup_assets.sh
```

This copies your existing PNGs and JSON data files into `godot/assets/` where Godot can find them.

### 3. Open in Godot

- Launch Godot
- Click **Import** → navigate to `godot/project.godot` → **Import & Edit**
- Press **F5** (or the Play button)

Rikizo should appear in the bedroom. Walk with arrow keys or WASD, interact with Space/Enter.

## Project structure

```
godot/
├── project.godot          # Engine config (viewport 800×600, input mappings)
├── setup_assets.sh        # Copies art from the main repo into assets/
├── .gitignore             # Ignores .godot/ cache and copied assets/
│
├── scripts/
│   ├── GameManager.gd     # Autoload singleton — state, data, trackers, save/load
│   ├── Player.gd          # CharacterBody2D — movement, animation, interact signal
│   ├── CollisionMap.gd    # Reads collision.png, generates StaticBody2D walls
│   ├── NPC.gd             # Area2D — proximity detection, conversation data
│   ├── InteractiveObject.gd  # Area2D — doors, furniture, message popups
│   ├── DialogueOverlay.gd # CanvasLayer — speech bubble + portrait + background
│   ├── TermProcessor.gd   # BBCode term tagging for RichTextLabel
│   └── DayLoader.gd       # Main scene script — loads day.json, builds world,
│                          #   routes all interactions including scripted events
│
├── scenes/
│   ├── main.tscn          # Root scene (map, player, NPCs, objects, UI)
│   ├── npc.tscn           # Prefab for NPC instances
│   └── interactive_object.tscn  # Prefab for object instances
│
└── assets/                # Created by setup_assets.sh (gitignored)
    ├── day-data/          # day.json, map.png, collision.png, sprites/
    ├── backgrounds/       # Conversation backgrounds (kitchen, living, void)
    ├── sprites/           # me_sheet.png, door.png
    └── data/              # glossary, particles, characters, rules JSONs
```

## How it maps to Game.js

| Game.js | Godot equivalent |
|---------|-----------------|
| `canvas` + `ctx.drawImage()` | Sprite2D nodes + Camera2D |
| `requestAnimationFrame(gameLoop)` | `_physics_process(delta)` on Player.gd |
| `game.keys` + `keydown/keyup` | Godot Input system (`Input.is_action_pressed`) |
| Pixel collision from `collision.png` | CollisionMap.gd → StaticBody2D grid |
| `game.doors` state | GameManager.doors dictionary |
| `processGameText()` + surface index | TermProcessor.gd + BBCode `[url]` tags |
| HTML conversation overlay | CanvasLayer with RichTextLabel + TextureRect |
| Per-NPC `convoBackground` | GameManager.convo_backgrounds + DialogueOverlay |
| `portraitOverrides` map | DialogueOverlay.portrait_overrides per conversation |
| `game.voidSeen` / `voidAsked` | GameManager.void_seen / void_asked |
| localStorage | `user://save_data.json` via FileAccess |

## What's next

- Touch controls (D-pad + interact button) for mobile
- Term modal popup when tapping vocab words
- Day 2+ content built natively in Godot
- Tracker effects (paranoia thresholds, relationship branching)
- iOS/Android export
