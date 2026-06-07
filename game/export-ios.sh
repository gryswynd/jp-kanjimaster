#!/usr/bin/env bash
# export-ios.sh — Export the Rikizo Adventure game to an iOS Xcode project, then
# patch in iPhone+iPad device support.
#
# Why the patch: Godot 4.6's export preset only accepts a SINGLE
# `targeted_device_family` value (1=iPhone, 2=iPad). There's no "both" value —
# passing 3 silently writes an EMPTY TARGETED_DEVICE_FAMILY, which makes Xcode
# offer only Mac/Vision as run destinations (no iPhone/iPad). So we export with
# 1, then rewrite the generated project's TARGETED_DEVICE_FAMILY to "1,2".
#
# The build/ios project is regenerated every export, so this script must be run
# (not a raw `--export`) whenever you produce a new game build for TestFlight.
#
# Usage:  cd game && ./export-ios.sh
set -euo pipefail
cd "$(dirname "$0")"

GODOT="${GODOT:-$HOME/Downloads/Godot.app/Contents/MacOS/Godot}"
PROJ="build/ios/Rikizo.xcodeproj/project.pbxproj"

echo "==> [1/4] Reimport assets…"
timeout 240 "$GODOT" --headless --import 2>&1 | grep -iE "SCRIPT ERROR|Parse Error|Failed to load" \
  | grep -viE "GameManager autoload|SafeArea autoload" || true

echo "==> [2/4] Export iOS Xcode project…"
rm -rf build/ios && mkdir -p build/ios
# Godot's runnable preset auto-runs xcodebuild (heavy + triggers sim-runtime
# verification). Run the export in the background and kill the xcodebuild storm
# once the project files are written (they're produced before the build step).
( timeout 240 "$GODOT" --headless --export-debug "iOS" build/ios/Rikizo.xcodeproj >/tmp/godot-export.log 2>&1 ) &
EP=$!
# Wait until the project file appears (or the export process exits).
for _ in $(seq 1 90); do
  [ -f "$PROJ" ] && break
  kill -0 "$EP" 2>/dev/null || break
  sleep 1
done
sleep 3   # let the rest of the project files flush
pkill -f "xcodebuild" 2>/dev/null || true
pkill -f "SWBBuildService" 2>/dev/null || true
pkill -f "ibtoold" 2>/dev/null || true
wait "$EP" 2>/dev/null || true

if [ ! -f "$PROJ" ]; then
  echo "ERROR: export did not produce $PROJ"; tail -20 /tmp/godot-export.log; exit 1
fi

echo "==> [3/4] Patch device family → iPhone+iPad (\"1,2\")…"
# Godot writes this inconsistently across versions/values: "" (empty), 1, 2,
# "1", or "2". Normalize EVERY TARGETED_DEVICE_FAMILY assignment to "1,2"
# regardless of its current value (quoted or bare).
/usr/bin/sed -i '' -E \
  's/TARGETED_DEVICE_FAMILY = ("?[0-9,]*"?);/TARGETED_DEVICE_FAMILY = "1,2";/g' \
  "$PROJ"

echo "==> [3b/4] Strip empty privacy-usage keys from Info.plist…"
# Godot stamps NSCamera/NSPhotoLibrary/NSMicrophone usage descriptions with EMPTY
# strings even though this game uses none of them. Empty usage strings warn at
# build time and can be rejected at App Store validation. The game requests none
# of these, so delete the keys outright via PlistBuddy.
INFO_PLIST="build/ios/Rikizo/Rikizo-Info.plist"
if [ -f "$INFO_PLIST" ]; then
  for key in NSCameraUsageDescription NSPhotoLibraryUsageDescription NSMicrophoneUsageDescription; do
    /usr/libexec/PlistBuddy -c "Delete :$key" "$INFO_PLIST" 2>/dev/null || true
  done
  echo "    removed empty camera/photo/mic usage keys (game uses none)"
fi

echo "==> [4/4] Verify…"
echo "  SDKROOT:"; grep -E "SDKROOT" "$PROJ" | sort -u | sed 's/^/    /'
PATCHED=$(grep -cE 'TARGETED_DEVICE_FAMILY = "1,2";' "$PROJ" || true)
REMAIN=$(grep -E 'TARGETED_DEVICE_FAMILY' "$PROJ" | grep -vcE 'TARGETED_DEVICE_FAMILY = "1,2";' || true)
echo "  device family: \"1,2\" count: $PATCHED   unpatched remaining: $REMAIN"
echo "  build #:"; grep -E "CURRENT_PROJECT_VERSION|MARKETING_VERSION" "$PROJ" | sort -u | sed 's/^/    /'
echo ""
echo "✓ Done. Open build/ios/Rikizo.xcodeproj in Xcode → Product → Archive → upload."
