extends Area2D
## Interactive objects: doors, furniture, items.
## Mirrors the object system from Game.js.
##
## Supports two modes:
##   Legacy: invisible hitbox over painted-in furniture (x/y/width/height)
##   Sprite: visible sprite PNG with collision (sprite + position + size)

@export var object_name: String = ""
@export var object_name_jp: String = ""
# Earliest day on which the JP name reveals (default 0 = always available).
# Before this day the label stays as ??? even after the player examines.
@export var name_from_day: int = 0
@export var is_door: bool = false
@export var message_data: Dictionary = {}  # { "jp": ..., "en": ..., "terms": [...] }
@export var interactive: bool = true
# Selection priority. Higher wins ties with overlapping objects (e.g. an
# item sitting on top of a counter — the counter's bbox south edge can be
# closer to the player than the item's, but the item should still be the
# tap target). Default 0; set on the day.json entry as `priority`.
# (Named with the `select_` prefix because plain `priority` collides with
# the built-in Area2D property.)
@export var select_priority: int = 0

@onready var label: Label = $InteractLabel
@onready var collision_shape: CollisionShape2D = $CollisionShape2D

var player_nearby := false
var obj_width: float = 0
var obj_height: float = 0
var obj_sprite: Sprite2D = null

# Padding added to the Area2D's detection shape so the player triggers
# body_entered just by approaching — without needing to walk THROUGH the
# StaticBody2D collision blocker that lives at obj_width × obj_height.
const DETECTION_PADDING: float = 30.0

# Per-object override read from day.json's `detectionPadding` field. Used
# when a sprite sits behind a blocker (e.g. on top of a counter) and the
# player has to interact from further away than the default reach.
var detection_padding: float = DETECTION_PADDING


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	# Refresh label after any conversation ends so ??? → name flips immediately.
	GameManager.conversation_ended.connect(_update_label)
	if label:
		label.visible = false


func setup(data: Dictionary) -> void:
	## Initialize from a day.json object entry.
	object_name = data.get("name", "")
	object_name_jp = data.get("nameJp", "")
	name_from_day = int(data.get("nameFromDay", 0))
	is_door = data.get("isDoor", false)
	interactive = data.get("interactive", true)
	detection_padding = float(data.get("detectionPadding", DETECTION_PADDING))
	select_priority = int(data.get("priority", 0))

	# Support both legacy (x/y) and new (position array) formats
	var x: float = 0
	var y: float = 0
	if data.has("position"):
		var pos: Array = data["position"]
		x = float(pos[0])
		y = float(pos[1])
	else:
		x = data.get("x", 0)
		y = data.get("y", 0)

	if data.has("size"):
		var sz: Array = data["size"]
		obj_width = float(sz[0])
		obj_height = float(sz[1])
	else:
		obj_width = data.get("width", 50)
		obj_height = data.get("height", 50)

	# Position at center of the defined rect
	global_position = Vector2(x + obj_width * 0.5, y + obj_height * 0.5)

	# Area2D detection shape is OBJECT BOUNDS + padding so the player
	# triggers body_entered just by approaching, even when a blocker
	# is sized to the object exactly.
	if collision_shape:
		var shape := RectangleShape2D.new()
		shape.size = Vector2(obj_width + detection_padding * 2, obj_height + detection_padding * 2)
		collision_shape.shape = shape

	# Load visible sprite if provided
	if data.has("sprite"):
		var sprite_path := _resolve_asset_path(str(data["sprite"]))
		if ResourceLoader.exists(sprite_path):
			obj_sprite = Sprite2D.new()
			obj_sprite.texture = load(sprite_path) as Texture2D
			obj_sprite.centered = false
			# Remember closed-state texture so doors can swap back
			set_meta("sprite_closed_path", sprite_path)
			var tex_size := obj_sprite.texture.get_size()
			# If no explicit size was provided, adopt the texture's bounds.
			if not data.has("size") and not data.has("width"):
				obj_width = tex_size.x
				obj_height = tex_size.y
				global_position = Vector2(x + obj_width * 0.5, y + obj_height * 0.5)
				if collision_shape:
					var shape2 := RectangleShape2D.new()
					shape2.size = Vector2(obj_width + detection_padding * 2, obj_height + detection_padding * 2)
					collision_shape.shape = shape2
			# Explicit size — scale the sprite so the visible art matches
			# the day.json size (and matches what the positioner shows). This
			# keeps the sprite, bbox, and collision all aligned.
			elif tex_size.x > 0 and tex_size.y > 0:
				obj_sprite.scale = Vector2(obj_width / tex_size.x, obj_height / tex_size.y)
			# Offset is in pre-scale texture pixels — divide by scale so the
			# sprite ends up centered on the object's global_position.
			obj_sprite.offset = Vector2(-tex_size.x * 0.5, -tex_size.y * 0.5)
			add_child(obj_sprite)

	# Door sprite swap support
	if is_door and data.has("spriteOpen"):
		set_meta("sprite_open_path", _resolve_asset_path(str(data["spriteOpen"])))

	if data.has("message"):
		message_data = data["message"]

	# Collision blocking for objects that should block movement
	if data.get("collision", false) and not is_door:
		_setup_static_blocker()

	if is_door:
		_setup_door_blocker()

	# Reposition the InteractLabel so it's visible — outside the sprite's
	# vertical extent. For tall objects (e.g. the tree), the label goes
	# BELOW the sprite so it doesn't sit hidden behind/above the canopy.
	_position_label_for_size()


func _position_label_for_size() -> void:
	if not label:
		return
	# Edge-zone exits (Exit_East/West/South, Path_North) span 800+ px on
	# one axis — the "outside the bbox" position would land off the chunk.
	# For those, anchor the label at the bbox center.
	if obj_width > 500.0 or obj_height > 500.0:
		label.offset_top = -10.0
		label.offset_bottom = 10.0
		return
	if obj_height > 200.0:
		# Place 10–30 px below the sprite's south edge
		label.offset_top = obj_height * 0.5 + 10.0
		label.offset_bottom = obj_height * 0.5 + 30.0
	else:
		# Place 10–30 px above the sprite's north edge
		label.offset_top = -obj_height * 0.5 - 30.0
		label.offset_bottom = -obj_height * 0.5 - 10.0


func _resolve_asset_path(sprite: String) -> String:
	## Resolve an object sprite path against known asset roots.
	## Accepts:
	##   - Absolute "res://..." paths (used as-is)
	##   - "shared/..." or "characters/..." legacy paths (prepend res://assets/)
	##   - Day-relative paths when set_meta("day_dir", ...) has been set by DayLoader
	##   - Anything else: treated as day-relative if day_dir is set, else res://assets/
	if sprite.begins_with("res://"):
		return sprite
	if sprite.begins_with("assets/"):
		# Cross-day or project-rooted path — prepend res:// only.
		return "res://" + sprite
	if sprite.begins_with("shared/") or sprite.begins_with("characters/"):
		return "res://assets/" + sprite
	if has_meta("day_dir"):
		return str(get_meta("day_dir")) + sprite
	return "res://assets/" + sprite


func _setup_static_blocker() -> void:
	## Create a StaticBody2D child that always blocks movement (for furniture/walls).
	## Blocker lives on layer 8 (not 1) so it doesn't trip the parent Area2D's
	## detector, which would suppress the player's body_entered event.
	var blocker := StaticBody2D.new()
	blocker.name = "StaticBlocker"
	blocker.collision_layer = 128  # layer 8 only
	blocker.collision_mask = 0     # blocker doesn't need to detect anything

	var shape := RectangleShape2D.new()
	shape.size = Vector2(obj_width, obj_height)

	var col := CollisionShape2D.new()
	col.shape = shape

	blocker.add_child(col)
	add_child(blocker)
	blocker.position = Vector2.ZERO


func _setup_door_blocker() -> void:
	## Same as above but disable-able when the door opens.
	var blocker := StaticBody2D.new()
	blocker.name = "DoorBlocker"
	blocker.collision_layer = 128
	blocker.collision_mask = 0

	var shape := RectangleShape2D.new()
	shape.size = Vector2(obj_width, obj_height)

	var col := CollisionShape2D.new()
	col.shape = shape

	blocker.add_child(col)
	add_child(blocker)
	blocker.position = Vector2.ZERO


func _update_door_blocker() -> void:
	var blocker := get_node_or_null("DoorBlocker")
	if blocker:
		var is_open := GameManager.is_door_open(object_name)
		# Disable collision when door is open
		blocker.get_child(0).disabled = is_open

	if not obj_sprite:
		return

	var is_open2 := GameManager.is_door_open(object_name)
	if is_open2:
		# Open state: swap to spriteOpen if provided, otherwise hide sprite entirely
		if has_meta("sprite_open_path"):
			var open_path: String = get_meta("sprite_open_path")
			if ResourceLoader.exists(open_path):
				obj_sprite.texture = load(open_path) as Texture2D
				obj_sprite.visible = true
		else:
			obj_sprite.visible = false
	else:
		# Closed state: restore the closed texture and make sure it's visible
		if has_meta("sprite_closed_path"):
			var closed_path: String = get_meta("sprite_closed_path")
			if ResourceLoader.exists(closed_path):
				obj_sprite.texture = load(closed_path) as Texture2D
		obj_sprite.visible = true


func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		player_nearby = true
		_update_label()


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		player_nearby = false
		_update_label()


func _update_label() -> void:
	if not label:
		return

	# Non-interactive objects never show a label
	if not interactive:
		label.visible = false
		return

	# Hide label for disabled doors
	if is_door and GameManager.is_door_disabled(object_name):
		label.visible = false
		return

	# Doors no longer surface their open/closed text — the sprite shows state.
	if is_door:
		label.visible = false
		return

	label.visible = player_nearby and not GameManager.in_conversation
	if player_nearby:
		var name_gated: bool = name_from_day > 0 and GameManager.current_day < name_from_day
		if GameManager.inspected.has(object_name) and not name_gated:
			label.text = object_name_jp
		else:
			label.text = "???"
