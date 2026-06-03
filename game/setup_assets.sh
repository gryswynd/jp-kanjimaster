#!/bin/bash
# Setup script: copies existing art assets into the Godot project
# so you can open the project in the Godot editor and hit Play immediately.
#
# Run from the repo root:  bash godot/setup_assets.sh
#
# Directory structure:
#   godot/assets/
#     shared/sprites/         Player spritesheet, door
#     shared/tilesets/        Tileset PNGs + .tres (populated by deploy_assets.sh)
#     shared/objects/         Reusable furniture sprites (populated by deploy_assets.sh)
#     days/day-01-home/       Day data: day.json, map.png, collision.png, characters/
#     backgrounds/            Conversation backgrounds
#     data/                   Glossary, particles, characters, rules
#     ui/                     Belt rank images

GODOT_DIR="godot"
ASSETS_DIR="$GODOT_DIR/assets"

echo "Setting up Godot assets..."

# Clean previous copy
rm -rf "$ASSETS_DIR"

# Create directories
mkdir -p "$ASSETS_DIR/shared/sprites"
mkdir -p "$ASSETS_DIR/shared/tilesets"
mkdir -p "$ASSETS_DIR/shared/objects"
mkdir -p "$ASSETS_DIR/days/day-01-home/characters"
mkdir -p "$ASSETS_DIR/backgrounds"
mkdir -p "$ASSETS_DIR/data"
mkdir -p "$ASSETS_DIR/ui"

# --- Day 01 assets ---
DAY_SRC="data/N5/game/day-01-home"

echo "  Copying Day 01 data..."
cp "$DAY_SRC/day.json"      "$ASSETS_DIR/days/day-01-home/day.json"
cp "$DAY_SRC/map.png"       "$ASSETS_DIR/days/day-01-home/map.png"       2>/dev/null || true
cp "$DAY_SRC/collision.png" "$ASSETS_DIR/days/day-01-home/collision.png" 2>/dev/null || true

echo "  Copying Day 01 character sprites..."
# NPC sprites + conversation portraits
cp "assets/characters/sakura/sakura_sprite.png"  "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
cp "assets/characters/sakura/sakura_convo.png"   "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
cp "assets/characters/taro/taro_sprite.png"      "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
cp "assets/characters/taro/taro_convo.png"       "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
# Player conversation portrait
cp "assets/characters/rikizo/rikizo_convo.png"   "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
# Alt portraits
cp "assets/characters/rikizo/rikizo-convo-shocked.png" "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true
cp "assets/characters/taro/taro-convo-angry.png"       "$ASSETS_DIR/days/day-01-home/characters/" 2>/dev/null || true

# --- Conversation backgrounds ---
echo "  Copying conversation backgrounds..."
cp "assets/backgrounds/convo-bg-kitchen.png" "$ASSETS_DIR/backgrounds/" 2>/dev/null || true
cp "assets/backgrounds/convo-bg-living.png"  "$ASSETS_DIR/backgrounds/" 2>/dev/null || true
cp "assets/backgrounds/convo-bg-void.png"    "$ASSETS_DIR/backgrounds/" 2>/dev/null || true

# --- Shared sprites ---
echo "  Copying shared sprites..."
# Player spritesheet — prefer rikizo_sheet, fall back to me_sheet in references
if [ -f "assets/characters/rikizo/rikizo_sheet.png" ]; then
    cp "assets/characters/rikizo/rikizo_sheet.png" "$ASSETS_DIR/shared/sprites/me_sheet.png"
elif [ -f "references/pixel_characters/me_sheet.png" ]; then
    cp "references/pixel_characters/me_sheet.png" "$ASSETS_DIR/shared/sprites/me_sheet.png"
fi
# Door sprite
if [ -f "door.png" ]; then
    cp "door.png" "$ASSETS_DIR/shared/sprites/door.png"
fi

# --- UI (belt rank images) ---
echo "  Copying UI assets..."
for belt in assets/ui/belt-*.png; do
    [ -f "$belt" ] && cp "$belt" "$ASSETS_DIR/ui/"
done

# --- Glossary & data files ---
echo "  Copying data files..."
cp "data/N5/glossary.N5.json"   "$ASSETS_DIR/data/glossary.N5.json"
cp "shared/particles.json"      "$ASSETS_DIR/data/particles.json"
cp "shared/characters.json"     "$ASSETS_DIR/data/characters.json"
cp "conjugation_rules.json"     "$ASSETS_DIR/data/conjugation_rules.json"
cp "counter_rules.json"         "$ASSETS_DIR/data/counter_rules.json"

echo ""
echo "Done! Assets are in $ASSETS_DIR/"
echo ""
echo "Next steps:"
echo "  1. Download Godot 4.3+ from https://godotengine.org/download"
echo "  2. Open Godot → Import → select godot/project.godot"
echo "  3. Press F5 (or the Play button) to run"
echo ""
echo "Rikizo should appear in the bedroom and you can walk around!"
