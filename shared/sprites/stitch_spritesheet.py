#!/usr/bin/env python3
"""
Stitch individual walk-cycle frames into the player sprite sheet (me_sheet.png).

Usage:
    python3 stitch_spritesheet.py [--frames-dir FRAMES_DIR] [--output OUTPUT] [--mirror-lr]

Arguments:
    --frames-dir    Directory containing individual frame PNGs (default: ./frames/)
    --output        Output sprite sheet path (default: ./me_sheet.png)
    --mirror-lr     Generate right-facing frames by flipping left-facing frames.
                    When enabled, only left-facing frames are required — right frames
                    are created automatically. This guarantees L/R consistency.

Frame Naming Convention:
    frame_{direction}_{col}_{phase}.png

    Directions: down, left, right, up
    Cols: 0-5
    Phases: idle, step_r, pass_r, step_l, pass_l, step_r2

    Examples:
        frame_down_0_idle.png
        frame_left_3_step_l.png
        frame_up_2_pass_r.png

    See walk_cycle_spec.json for the full frame list and pose descriptions.

Sheet Layout:
    Row 0: down  (frames 0-5)
    Row 1: left  (frames 0-5)
    Row 2: right (frames 0-5)
    Row 3: up    (frames 0-5)

    Each cell: 204 x 293 pixels
    Total: 1224 x 1172 pixels (6 cols x 4 rows)
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install with: pip3 install Pillow")
    sys.exit(1)


FRAME_WIDTH = 204
FRAME_HEIGHT = 293
COLS = 6
ROWS = 4
DIRECTIONS = ["down", "left", "right", "up"]


def load_spec(spec_path: Path) -> dict:
    """Load the walk cycle specification JSON."""
    with open(spec_path) as f:
        return json.load(f)


def find_frame(frames_dir: Path, direction: str, col: int, spec_frames: list) -> Path | None:
    """Find the frame file for a given direction and column."""
    # Look up expected filename from spec
    for frame in spec_frames:
        if frame["direction"] == direction and frame["col"] == col:
            path = frames_dir / frame["filename"]
            if path.exists():
                return path

    # Fallback: glob for any matching pattern
    pattern = f"frame_{direction}_{col}_*.png"
    matches = list(frames_dir.glob(pattern))
    if matches:
        return matches[0]

    return None


def stitch(frames_dir: Path, output_path: Path, mirror_lr: bool = False):
    """Assemble individual frames into the sprite sheet."""

    # Load spec for filename reference
    spec_path = Path(__file__).parent / "walk_cycle_spec.json"
    spec_frames = []
    if spec_path.exists():
        spec = load_spec(spec_path)
        spec_frames = spec.get("frames", [])

    # Create the output sheet with black background
    sheet = Image.new("RGBA", (COLS * FRAME_WIDTH, ROWS * FRAME_HEIGHT), (0, 0, 0, 255))

    missing = []
    placed = 0

    for row_idx, direction in enumerate(DIRECTIONS):
        for col in range(COLS):
            # If mirror mode: right-facing frames come from flipping left-facing frames
            source_direction = direction
            flip = False
            if mirror_lr and direction == "right":
                source_direction = "left"
                flip = True

            frame_path = find_frame(frames_dir, source_direction, col, spec_frames)

            if frame_path is None:
                label = f"{direction} col {col}"
                if flip:
                    label += f" (mirror from left col {col})"
                missing.append(label)
                continue

            frame_img = Image.open(frame_path).convert("RGBA")

            # Resize if needed (should already be 204x293 but handle slight variations)
            if frame_img.size != (FRAME_WIDTH, FRAME_HEIGHT):
                print(f"  WARNING: {frame_path.name} is {frame_img.size}, resizing to {FRAME_WIDTH}x{FRAME_HEIGHT}")
                frame_img = frame_img.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.NEAREST)

            if flip:
                frame_img = frame_img.transpose(Image.FLIP_LEFT_RIGHT)

            x = col * FRAME_WIDTH
            y = row_idx * FRAME_HEIGHT
            sheet.paste(frame_img, (x, y))
            placed += 1

            source_label = f"{source_direction}/{col}" + (" (flipped)" if flip else "")
            print(f"  [{row_idx},{col}] {direction} {col} ← {frame_path.name}{' (flipped)' if flip else ''}")

    print(f"\nPlaced {placed}/24 frames.")

    if missing:
        print(f"\nMISSING {len(missing)} frames:")
        for m in missing:
            print(f"  - {m}")

    sheet.save(output_path)
    print(f"\nSaved sprite sheet to: {output_path}")
    print(f"Dimensions: {sheet.size[0]}x{sheet.size[1]}")

    return len(missing) == 0


def extract(sheet_path: Path, output_dir: Path):
    """Extract individual frames from an existing sprite sheet (reverse operation)."""
    sheet = Image.open(sheet_path).convert("RGBA")

    if sheet.size != (COLS * FRAME_WIDTH, ROWS * FRAME_HEIGHT):
        print(f"WARNING: Sheet is {sheet.size}, expected {COLS * FRAME_WIDTH}x{ROWS * FRAME_HEIGHT}")

    output_dir.mkdir(parents=True, exist_ok=True)

    phases = ["idle", "step_r", "pass_r", "step_l", "pass_l", "step_r2"]

    for row_idx, direction in enumerate(DIRECTIONS):
        for col in range(COLS):
            x = col * FRAME_WIDTH
            y = row_idx * FRAME_HEIGHT
            frame = sheet.crop((x, y, x + FRAME_WIDTH, y + FRAME_HEIGHT))
            filename = f"frame_{direction}_{col}_{phases[col]}.png"
            frame.save(output_dir / filename)
            print(f"  Extracted {filename}")

    print(f"\nExtracted 24 frames to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Stitch individual walk-cycle frames into the player sprite sheet."
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Stitch command
    stitch_parser = subparsers.add_parser("stitch", help="Assemble frames into sprite sheet")
    stitch_parser.add_argument(
        "--frames-dir",
        type=Path,
        default=Path(__file__).parent / "frames",
        help="Directory containing individual frame PNGs (default: ./frames/)"
    )
    stitch_parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "me_sheet.png",
        help="Output sprite sheet path (default: ./me_sheet.png)"
    )
    stitch_parser.add_argument(
        "--mirror-lr",
        action="store_true",
        help="Generate right-facing frames by flipping left-facing frames"
    )

    # Extract command (reverse operation — useful for editing existing sheets)
    extract_parser = subparsers.add_parser("extract", help="Extract frames from existing sprite sheet")
    extract_parser.add_argument(
        "--sheet",
        type=Path,
        default=Path(__file__).parent / "me_sheet.png",
        help="Input sprite sheet path"
    )
    extract_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "frames",
        help="Directory to save extracted frames"
    )

    args = parser.parse_args()

    if args.command == "stitch":
        if not args.frames_dir.exists():
            print(f"ERROR: Frames directory not found: {args.frames_dir}")
            print(f"Create it and add individual frame PNGs, or use 'extract' to split an existing sheet.")
            sys.exit(1)
        success = stitch(args.frames_dir, args.output, args.mirror_lr)
        sys.exit(0 if success else 1)

    elif args.command == "extract":
        if not args.sheet.exists():
            print(f"ERROR: Sprite sheet not found: {args.sheet}")
            sys.exit(1)
        extract(args.sheet, args.output_dir)

    else:
        parser.print_help()
        print("\nExamples:")
        print("  python3 stitch_spritesheet.py stitch --frames-dir ./frames/ --output ./me_sheet.png")
        print("  python3 stitch_spritesheet.py stitch --frames-dir ./frames/ --mirror-lr")
        print("  python3 stitch_spritesheet.py extract --sheet ./me_sheet.png --output-dir ./frames/")


if __name__ == "__main__":
    main()
