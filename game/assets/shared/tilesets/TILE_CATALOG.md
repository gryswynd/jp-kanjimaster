# GuttyKreum Interior Essentials — Tile Catalog

Tileset: `house_interior.png` — 2336x704px, 73 cols × 22 rows, 32x32px tiles.
**Tile ID formula:** `tile_id = row × 73 + col` (0-indexed)

---

## FLOORS (solid surface tiles, no walls)

### Brick/Stone Floor
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 1 | 0,1 | Brick floor — warm brown horizontal bricks |
| 20-23 | 0,20-23 | Large brick pattern (2×2 block, use all 4) |
| 93-96 | 1,20-23 | Large brick pattern variant (darker, 2×2) |
| 166-169 | 2,20-23 | Large brick pattern variant (2×2) |

### Wood Plank Floor
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 438-441 | 6,0-3 | Dark studded wood planks (4 variants) |
| 511-514 | 7,0-3 | Dark studded wood planks (more variants) |

### Clean Floors (Row 21 — extracted from RPG Maker A2)
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 1533-1536 | 21,0-3 | Beige brick floor (4 seamless variants) |
| 1537-1540 | 21,4-7 | Light blue checker tile floor (4 variants) |
| 1541-1544 | 21,8-11 | Orange/grey checker pattern (4 variants) |
| 1545-1548 | 21,12-15 | Dark brown studded wood (4 variants) |
| 1549-1550 | 21,16-17 | Dark wood plank (2 variants) |
| 1551-1552 | 21,18-19 | Purple/lavender tile (2 variants) |

### Autotile Floor Systems (47-variant RPG Maker sets)
These are pre-composited autotile variants for seamless edges/corners.

| Region | Row,Col range | Description |
|--------|--------------|-------------|
| Rows 4-7, cols 40-59 | Various | Blue/white checker tile autotile (bathroom) |
| Rows 4-7, cols 40-59 | Various | Beige brick autotile |
| Rows 8-11, cols 40-59 | Various | Orange/grey checker autotile |
| Rows 12-15, cols 40-59 | Various | Dark wood floor autotile |
| Rows 16-19, cols 40-59 | Various | Dark brick floor autotile |

---

## 3D PERSPECTIVE WALLS

### Horizontal Walls (top/bottom of rooms — show wall face with depth)

**Cream/Beige Walls:**
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 4-7 | 0,4-7 | Top wall face — cream, tall (shows wall height from above) |
| 8-15 | 0,8-15 | Top wall with shelf/trim variants |
| 81-87 | 1,8-14 | Wall mid-section — long horizontal wall, darker shelf rail |
| 155-160 | 2,9-14 | Wall bottom edge — baseboard/lower trim |
| 227-232 | 3,8-13 | Wall horizontal continuation pieces |
| 300-306 | 4,8-14 | Wall with white trim/windows at top |
| 373-378 | 5,8-13 | Wall horizontal — plain with shelf |
| 446-451 | 6,8-13 | More wall shelf variants |
| 519-524 | 7,8-13 | Thin wall trim/baseboard pieces |

**Dark Brown/Wood Panel Walls:**
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 89-92 | 1,16-19 | Dark brown wall with window rail (horizontal) |
| 162-165 | 2,16-19 | Dark wall lower section |
| 236-238 | 3,17-19 | Dark wall continuation |
| 308-311 | 4,16-19 | Dark wall with blue trim |
| 381-384 | 5,16-19 | Dark wall shelf |
| 454-457 | 6,16-19 | Dark wall lower |
| 527-530 | 7,16-19 | Dark wall baseboard |

**Dark Wood Shoji Walls (Japanese style):**
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 593-598 | 8,9-14 | Shoji paper wall — cream with blue trim at top |
| 600-603 | 8,16-19 | Cream wall with glass/window |
| 666-671 | 9,8-13 | Shoji wall mid section |
| 739-743 | 10,8-13 | Shoji wall lower with glass panels |
| 812-818 | 11,8-13 | Shoji wall with drawer detail |

### Vertical Walls (left/right edges of rooms)
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 73 | 1,0 | Left wall edge — dark brown vertical |
| 146 | 2,0 | Left wall continuation |
| 219 | 3,0 | Left wall — with window light |
| 292 | 4,0 | Left wall — with trim |
| 365 | 5,0 | Left wall — studded wood |
| 511 | 7,0 | Left wall — baseboard |

### Wall Corners
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 0 | 0,0 | Top-left corner — dark brown |
| 15 | 0,15 | Top-right area |
| 87 | 1,14 | Wall end piece |

### Windows in Walls
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 3 | 0,3 | Window — shoji grid pattern |
| 75 | 1,2 | Door — brown wooden |
| 78 | 1,5 | Round window — ornate |
| 79-80 | 1,6-7 | Grid windows — square pane |
| 150 | 2,4 | Window — diamond grid |
| 151 | 2,5 | Ornate round blue window |
| 152 | 2,6 | Small arched window |
| 153 | 2,7 | Wall panel with detail |
| 296 | 4,4 | Round ornate window |
| 297-298 | 4,5-6 | Grid window variants |
| 299 | 4,7 | Arched blue window |
| 369-370 | 5,4-5 | Window with round/blue pane |
| 371-372 | 5,6-7 | Grid window, arched door with lantern |

### Doors
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 2 | 0,2 | Wooden door (closed, top-down view) |
| 75 | 1,2 | Wooden door variant |
| 515-518 | 7,4-7 | Bathroom blue tile wall with doorway |

### Dark Wood Bookshelf Walls (Japanese-style full wall units)
| Tile ID | Row,Col | Description |
|---------|---------|-------------|
| 588-591 | 8,3-7 | Bed/shelf unit on dark wall, top section |
| 661-664 | 9,3-7 | Dark wall with round/grid windows |
| 734-737 | 10,3-7 | Dark wall with window panes |
| 803-810 | 11,0-7 | Dark wall baseboard with tile pattern |

---

## FURNITURE

### Sofas & Couches
| Tile IDs | Size | Description |
|----------|------|-------------|
| 312-313, 385-388, 458-461 | 2×1 top + 4×1 mid + 4×1 bottom | Brown leather sofa (large, ~4 tiles wide) |
| 538-541 | 4×1 | Green sofa/couch |
| 651-653 | 3×1 | Orange/coral sofa top |
| 684-686 | 3×1 | Orange sofa seat/bottom |
| 943-944 | 2×1 | Blue/purple sofa top |
| 830-832 | 3×1 | Blue/lavender sofa |

### Chairs & Seating
| Tile ID | Description |
|---------|-------------|
| 25 | Wooden chair (front view) |
| 26 | Small stool/table |
| 27 | Wooden chair (side view) |
| 28 | Chair variant |
| 67 | Green cushioned chair |
| 70 | Armchair — orange/brown |
| 71-72 | Blue desk chair (2 variants) |
| 144-145 | Blue desk chair variants |
| 432-434 | Orange/red armchair pieces |
| 505-506 | Orange armchair pieces |
| 576-578 | Orange chair small pieces |
| 724-727 | Blue/purple armchairs |
| 797-798 | Blue armchair pieces |
| 868-870 | Blue armchair small |

### Tables
| Tile IDs | Size | Description |
|----------|------|-------------|
| 29-30 | 2×1 | Small desk/table |
| 1014-1015 | 2×1 | Low table/kotatsu (top view, brown with pattern) |
| 1087-1088 | 2×1 | Low table/bench variant |
| 1160-1161 | 2×1 | Coffee table |
| 696 | 1×1 | Oval rug/mat (large, brown/cat face) |
| 322 | 1×1 | Orange/brown mat/rug |

### Beds
| Tile IDs | Size | Description |
|----------|------|-------------|
| 359-361 | 3×1 | Green bed/futon (top section, with headboard) |
| 943-945 | 3×1 | Blue/purple bed top |
| 651-653 | 3×1 | Orange/coral bed top frame |

### Kitchen
| Tile ID | Description |
|---------|-------------|
| 325-328 | Kitchen appliances — stove top, oven, range pieces |
| 398-400 | Kitchen counter sections |
| 616-619 | Kitchen counters — full set (stove, sink, prep) |
| 689-692 | Kitchen lower cabinets |
| 762-764 | Long counter/prep surface |

### Bathroom
| Tile IDs | Description |
|----------|-------------|
| 38 | Bathtub (top view) |
| 39 | Toilet (top view) |
| 111 | Washing machine |
| 443-445 | Blue checker bathroom floor tiles |

### Bookshelves & Storage
| Tile IDs | Description |
|----------|-------------|
| 34-36 | Bookshelf sections (books visible) |
| 107-108 | Bookshelf wall unit pieces |
| 900-901 | Cabinet/drawer set |
| 973-976 | Tall bookshelf/cabinet sections |
| 1046-1047 | Short shelf/drawer |
| 1115-1118 | Dark bookshelf with ornate doors |
| 835 | Book row/bookshelf piece |

### Electronics & Appliances
| Tile ID | Description |
|---------|-------------|
| 31 | Desktop computer/laptop |
| 102-106 | TV/monitor variants (multiple sizes) |
| 175-178 | TV/microwave variants |
| 469 | Digital clock/radio display |
| 620-621 | Kitchen appliance/microwave |
| 693 | Kitchen hood/appliance |

### Decorative Items
| Tile ID | Description |
|---------|-------------|
| 97-100 | Round decorative fans/ornaments |
| 109-110 | Decorative chest/furniture |
| 170-174 | Round fans, dragon sculpture |
| 179-181 | Picture frames, folding screen (byobu) |
| 251-253 | Folding screen (byobu) — large decorative |
| 323 | Teapot |
| 330-331 | Cushion/zabuton (orange, red) |
| 403-404 | Cushion variants |
| 470-472 | Incense burner with smoke |
| 474-477 | Fish bowl, decorative vases |
| 536-537 | Potted plant (bonsai-style) |
| 608-609 | Potted plant on stand (bonsai) |
| 681-682 | Decorative branches (cherry blossom) |
| 754-755 | Cherry blossom branch in vase |
| 839 | Wooden sandals/geta |
| 985 | Round wooden tray/barrel lid |
| 986-987 | Wooden statue/figurine |
| 1054-1058 | Decorative stands, vases, figurines |
| 1125-1126 | Katana/sword on display stand |
| 1131-1132 | Wooden sandals/slippers row |
| 695-696 | Oval rug (cat face pattern) |

### Wall Hangings (place on wall layer)
| Tile ID | Description |
|---------|-------------|
| 107 | Framed picture |
| 179 | Picture frame (portrait) |
| 180 | Wall picture (landscape) |
| 879 | Decorative crest/emblem |
| 952 | Oni mask / wall decoration |

---

## AUTOTILE WALL SYSTEMS (RPG Maker VX Ace format)

These are 47-variant autotile sets. Each set occupies a specific region and provides all edge/corner combinations automatically.

### Cream/Beige Brick Walls
| Region | Rows,Cols | Description |
|--------|-----------|-------------|
| Rows 0-3, cols 40-59 | Full set | Cream brick wall autotiles — all corners, edges, junctions |

### Blue/White Checker Tile Walls
| Region | Rows,Cols | Description |
|--------|-----------|-------------|
| Rows 4-7, cols 40-59 | Full set | Blue checker autotile (bathroom walls) |

### Orange/Grey Checker Walls
| Region | Rows,Cols | Description |
|--------|-----------|-------------|
| Rows 8-11, cols 40-59 | Full set | Orange/grey checker autotile |

### Dark Wood Panel Walls
| Region | Rows,Cols | Description |
|--------|-----------|-------------|
| Rows 12-15, cols 40-59 | Full set | Dark wood panel wall autotiles |
| Rows 16-19, cols 40-59 | Full set | Dark brick wall autotiles |

---

## BUILDING A ROOM — Quick Reference

To build a room like Screenshot 1 (the main house), you need:

### Layer 1: Floor
Pick a floor tile and fill the room area:
- Living room: `1533` (beige brick) or `1` (brown brick)
- Bathroom: `1537` (blue checker) or `443-445`
- Kitchen: `1545` (dark wood)
- Tatami room: Use tatami tiles from autotile sections

### Layer 2: Walls
Use the 3D perspective wall tiles:
- **Top wall** (facing player): Use tiles from rows 0-1 cols 4-15 (cream) or rows 1-2 cols 16-19 (dark)
- **Side walls**: Tiles at col 0 of rows 1-5
- **Bottom wall** (behind player): thinner, from rows 6-7
- **Wall junctions**: Autotile sections for complex corners

### Layer 3: Objects (furniture)
Place furniture sprites on top of floor:
- Each piece noted above with tile IDs
- Multi-tile furniture: assemble from listed pieces (e.g., sofa = 3-4 tiles wide)

### Windows & Doors
Place in wall layer gaps:
- Windows: `78` (round), `79-80` (grid), `296-299` (various)
- Doors: `2` (wooden), or leave wall gap + door frame tiles

---

## TILE ID QUICK LOOKUP

```
Row  0: 0-72     | Floors, top walls, windows, small furniture, autotile
Row  1: 73-145   | Walls, windows, shelves, TVs, autotile
Row  2: 146-218  | Walls, doors, fans, screens, autotile
Row  3: 219-291  | Windows, walls, shelves, chairs, autotile
Row  4: 292-364  | Stairs, windows, walls, kitchen, cushions, autotile
Row  5: 365-437  | Wood floor, doors, walls, sofa, kitchen, autotile
Row  6: 438-510  | Wood floor, bathroom tile, walls, couch, decor, autotile
Row  7: 511-583  | Wood floor, bathroom, trim, plants, sofa, chairs, autotile
Row  8: 584-656  | Checker floor, dark walls, windows, shelves, beds, orange sofa
Row  9: 657-729  | Checker floor, dark walls, plants, orange couch, kitchen, rug
Row 10: 730-802  | Checker floor, dark walls, couch, counter, appliances, chairs
Row 11: 803-875  | Tile floor, dark walls, shelves, sofas, bookcase, chairs
Row 12: 876-948  | Tile floor, art, brick wall, doors, beds, blue sofa, figurine
Row 13: 949-1021 | Brick, shelves, cabinets, decor, stands, dark wood autotile
Row 14: 1022-1094| Dark wood autotile, table, bench
Row 15: 1095-1167| Tile floor, dark wood autotile, table
Row 16: 1168-1240| Dark brick autotile (top-left corner only, rest empty)
Row 17: 1241-1313| Dark brick autotile (continued)
Row 18: 1314-1386| Dark brick autotile (continued)
Row 19: 1387-1459| Dark brick autotile (bottom pieces)
Row 20: 1460-1532| Brick/tile/checker transition pieces (RPG Maker edge tiles)
Row 21: 1533-1605| CUSTOM: clean floor tiles (beige, blue, checker, dark, lavender)
```
