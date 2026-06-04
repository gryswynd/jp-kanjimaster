extends Area2D
## An NPC that the player can interact with to trigger a conversation.

## Emitted when the player walks into this NPC's interaction area. DayLoader
## listens and decides whether to auto-trigger a conversation (e.g. Dad on
## Day 4 forcing the phone hand-off even if the player tries to walk past).
signal proximity_entered(npc)

@export var npc_name: String = ""
@export var npc_name_jp: String = ""
@export var conversation: Array = []
@export var convo_portrait_texture: Texture2D

@onready var sprite: Sprite2D = $Sprite2D
@onready var label: Label = $InteractLabel
@onready var collision_shape: CollisionShape2D = $CollisionShape2D

var player_nearby := false


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	# Refresh label after any conversation ends so ??? → name flips immediately.
	GameManager.conversation_ended.connect(_update_label)
	if label:
		label.visible = false


func setup(data: Dictionary, sprite_tex: Texture2D, portrait_tex: Texture2D) -> void:
	## Initialize from day.json NPC entry.
	npc_name = data.get("name", "")
	npc_name_jp = data.get("nameJp", "")
	conversation = data.get("conversation", [])
	global_position = Vector2(data.get("x", 0), data.get("y", 0))

	if sprite_tex and sprite:
		sprite.texture = sprite_tex
		# Sizing — prefer explicit spriteWidth/spriteHeight from day.json.
		var tex_w: float = float(sprite_tex.get_width())
		var tex_h: float = float(sprite_tex.get_height())
		var aspect: float = tex_w / tex_h
		var has_explicit_size: bool = data.has("spriteWidth") or data.has("spriteHeight")
		var target_h: float = float(data.get("spriteHeight", 108))
		var target_w: float = float(data.get("spriteWidth", target_h * aspect))
		sprite.scale = Vector2(target_w / tex_w, target_h / tex_h)
		# Anchor mode:
		#   - With explicit spriteWidth/spriteHeight: TOP-LEFT at (x, y),
		#     matching the positioner's display + InteractiveObject convention.
		#   - Without explicit dims: legacy feet-anchor (sprite draws upward
		#     from position) for Game.js parity with day-01-home NPCs.
		if has_explicit_size:
			# Position node at the bbox center; Sprite2D's centered=true (default)
			# already centers the texture on the origin, so no offset needed.
			# Visible texture spans (x, y) .. (x + w, y + h) — matches positioner.
			global_position = Vector2(global_position.x + target_w * 0.5,
			                          global_position.y + target_h * 0.5)
			sprite.offset = Vector2.ZERO
		else:
			sprite.offset = Vector2(0, -tex_h * 0.5)

	convo_portrait_texture = portrait_tex

	# Per-NPC interaction radius — for NPCs that sit behind a counter or wall
	# the default 70px circle doesn't reach the player on the sidewalk.
	var radius_override: float = float(data.get("interactionRadius", 0))
	if radius_override > 0 and collision_shape and collision_shape.shape is CircleShape2D:
		var new_shape := CircleShape2D.new()
		new_shape.radius = radius_override
		collision_shape.shape = new_shape

	# Optional physical collision so the player bumps into the NPC.
	if data.get("collision", false):
		_setup_npc_blocker()


func _setup_npc_blocker() -> void:
	var blocker := StaticBody2D.new()
	blocker.name = "NpcBlocker"
	# Layer 8 so this blocker doesn't get detected by the parent Area2D
	# (which is on mask 1 for the player's CharacterBody2D).
	blocker.collision_layer = 128
	blocker.collision_mask = 0
	var shape := RectangleShape2D.new()
	shape.size = Vector2(40, 40)
	var col := CollisionShape2D.new()
	col.shape = shape
	blocker.add_child(col)
	add_child(blocker)
	blocker.position = Vector2.ZERO


func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		player_nearby = true
		_update_label()
		proximity_entered.emit(self)


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		player_nearby = false
		_update_label()


func _update_label() -> void:
	if not label:
		return
	label.visible = player_nearby and not GameManager.in_conversation
	if player_nearby:
		if GameManager.inspected.has(npc_name):
			label.text = npc_name_jp
		else:
			label.text = "???"
