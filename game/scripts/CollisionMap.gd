extends Node2D
## Reads collision-mask pixel data and generates StaticBody2D collision shapes.
## Red pixels (#FF0000) → wall. Blue pixels (#0000FF) → interactive zone.
##
## Supports two modes:
##   Single texture (legacy): one collision.png for the whole map.
##   Multi-mask (painted chunked maps): one mask per map chunk with a world-space
##   {x, y} offset. Each mask is scanned independently; the resulting StaticBody2D
##   nodes are positioned in world space using the offset.
##
## Strategy: scan each collision image in horizontal runs (RLE) and create
## rectangular CollisionShape2D bodies for each run of wall pixels.
## This is much more efficient than per-pixel bodies.

const TILE_SIZE := 8  # Sample every 8px for collision rects (balances accuracy vs body count)

# Legacy single-mask state (kept so is_wall/is_interactive_zone still work for Day 1)
var collision_image: Image
var image_width := 0
var image_height := 0

# Multi-mask state (painted chunked maps)
var mask_images: Array = []  # Array of { image: Image, offset: Vector2i, w: int, h: int }


func build_from_texture(collision_texture: Texture2D) -> void:
	## Legacy entry point: one texture, no offset. Kept for Day 1 backwards-compat.
	collision_image = collision_texture.get_image()
	image_width = collision_image.get_width()
	image_height = collision_image.get_height()

	mask_images = [{
		"image": collision_image,
		"offset": Vector2i.ZERO,
		"w": image_width,
		"h": image_height,
	}]

	_generate_wall_bodies_for_mask(collision_image, Vector2i.ZERO)


func clear_walls() -> void:
	## Remove all child StaticBody2D wall bodies. Called by DayLoader when
	## transitioning between days so the old day's walls don't persist.
	mask_images.clear()
	collision_image = null
	image_width = 0
	image_height = 0
	for c in get_children():
		c.queue_free()


func build_from_textures(masks: Array) -> void:
	## New entry point for chunked maps. Pass an Array of Dictionaries:
	##   [{ "texture": Texture2D, "offset": Vector2(x, y) }, ...]
	## Each mask is scanned independently in its own local coordinates,
	## then the resulting StaticBody2D bodies are positioned in world space
	## at offset + local_position.
	mask_images.clear()
	for entry in masks:
		var tex: Texture2D = entry.get("texture")
		if tex == null:
			continue
		var off_v = entry.get("offset", Vector2.ZERO)
		var offset := Vector2i(int(off_v.x), int(off_v.y))
		var img: Image = tex.get_image()
		mask_images.append({
			"image": img,
			"offset": offset,
			"w": img.get_width(),
			"h": img.get_height(),
		})
		_generate_wall_bodies_for_mask(img, offset)

	# Populate legacy fields with the first mask so is_wall() still answers
	# something for callers that happen to query it.
	if mask_images.size() > 0:
		collision_image = mask_images[0]["image"]
		image_width = mask_images[0]["w"]
		image_height = mask_images[0]["h"]


func is_wall(x: float, y: float) -> bool:
	## Check if a world position is a wall pixel (red).
	## Searches all masks; any mask covering (x,y) with a red pixel counts as wall.
	var ix := int(x)
	var iy := int(y)
	for mask in mask_images:
		var off: Vector2i = mask["offset"]
		var lx := ix - off.x
		var ly := iy - off.y
		if lx >= 0 and ly >= 0 and lx < int(mask["w"]) and ly < int(mask["h"]):
			var color: Color = (mask["image"] as Image).get_pixel(lx, ly)
			if color.r > 0.78 and color.g < 0.2 and color.b < 0.2:
				return true
	return false


func is_interactive_zone(x: float, y: float) -> bool:
	## Check if a world position is a blue interactive zone.
	var ix := int(x)
	var iy := int(y)
	for mask in mask_images:
		var off: Vector2i = mask["offset"]
		var lx := ix - off.x
		var ly := iy - off.y
		if lx >= 0 and ly >= 0 and lx < int(mask["w"]) and ly < int(mask["h"]):
			var color: Color = (mask["image"] as Image).get_pixel(lx, ly)
			if color.b > 0.78 and color.r < 0.2 and color.g < 0.2:
				return true
	return false


func _generate_wall_bodies_for_mask(img: Image, offset: Vector2i) -> void:
	## Scan a single mask in a grid and create rectangular bodies for contiguous
	## wall runs. Bodies are positioned in WORLD space using `offset`.
	var w := img.get_width()
	var h := img.get_height()

	for gy in range(0, h, TILE_SIZE):
		var run_start := -1
		for gx in range(0, w, TILE_SIZE):
			if _is_wall_tile_local(img, gx, gy, w, h):
				if run_start < 0:
					run_start = gx
			else:
				if run_start >= 0:
					_create_wall_rect(offset.x + run_start, offset.y + gy, gx - run_start, TILE_SIZE)
					run_start = -1
		if run_start >= 0:
			_create_wall_rect(offset.x + run_start, offset.y + gy, w - run_start, TILE_SIZE)


func _is_wall_tile_local(img: Image, gx: int, gy: int, w: int, h: int) -> bool:
	var cx := mini(gx + TILE_SIZE / 2, w - 1)
	var cy := mini(gy + TILE_SIZE / 2, h - 1)
	var color := img.get_pixel(cx, cy)
	return color.r > 0.78 and color.g < 0.2 and color.b < 0.2


func _create_wall_rect(x: int, y: int, w: int, h: int) -> void:
	var body := StaticBody2D.new()
	body.position = Vector2(x + w * 0.5, y + h * 0.5)

	var shape := RectangleShape2D.new()
	shape.size = Vector2(w, h)

	var col := CollisionShape2D.new()
	col.shape = shape

	body.add_child(col)
	add_child(body)
