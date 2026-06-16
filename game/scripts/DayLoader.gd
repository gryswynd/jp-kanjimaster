extends Node2D
## Main scene controller. Loads day.json data, creates map, NPCs, objects,
## and wires up the player interaction system including scripted events.
##
## Supports three map modes (checked in this order):
##   Painted+Chunked: assets.map.chunks[] + assets.map.collision[] (current production)
##   TileMap:         assets.tileLayout JSON + tileset (fallback, preserved)
##   Legacy:          assets.map + assets.collision single-texture (back-compat for Day 1)

const NPC_SCENE := preload("res://scenes/npc.tscn")
const OBJECT_SCENE := preload("res://scenes/interactive_object.tscn")

# New kanji introduced by each day's N5 lesson (from N5_GAME_ROADMAP.md):
# KANJI_BY_DAY[N] = the kanji unlocked by Day N (taught by lesson N5.N).
# The end-of-day recap looks up prev_day + 1, because the lesson Rikizo
# does to CLOSE OUT a day is the one that UNLOCKS the following day.
const KANJI_BY_DAY := {
	2: "日月火水木金土毎今何",
	3: "一二三四五六七八九十百千万円",
	4: "時分年週半",
	5: "行来店駅家",
	6: "山川道車",
	7: "大小食飲",
	8: "古新買長高安",
	9: "前後中外",
	10: "天電気休",
	11: "空雨花魚",
	12: "本語学校国",
	13: "手言読書話",
	14: "少多白間",
	15: "北南東西",
	16: "右左上下",
	17: "午口出入会社",
	18: "目見耳聞足立",
}

var DAY_DATA_DIR := "res://assets/days/day-01-home/"
var DAY_JSON := "res://assets/days/day-01-home/day.json"
const GLOSSARY_N5 := "res://assets/data/glossary.N5.json"
const PARTICLES := "res://assets/data/particles.json"
const CHARACTERS := "res://assets/data/characters.json"
const CONJ_RULES := "res://assets/data/conjugation_rules.json"
const COUNTER_RULES := "res://assets/data/counter_rules.json"

const TILE_SIZE := 32

@onready var map_sprite: Sprite2D = $Map
@onready var map_chunks: Node2D = get_node_or_null("MapChunks")
@onready var collision_map: Node2D = $CollisionMap
@onready var player: CharacterBody2D = $Player
@onready var camera: Camera2D = $Player/Camera2D
@onready var npcs_container: Node2D = $NPCs
@onready var objects_container: Node2D = $Objects
@onready var dialogue_overlay: CanvasLayer = $DialogueOverlay
@onready var calendar_overlay: CanvasLayer = $CalendarOverlay
@onready var choice_overlay: CanvasLayer = $ChoiceOverlay
@onready var inventory_overlay: CanvasLayer = $InventoryOverlay
@onready var quest_overlay: CanvasLayer = $QuestLogOverlay
@onready var phone_overlay: CanvasLayer = $PhoneOverlay
@onready var wallet_overlay: CanvasLayer = $WalletOverlay
@onready var messages_overlay: CanvasLayer = $MessagesOverlay
@onready var conversation_overlay: CanvasLayer = $ConversationOverlay
@onready var shop_menu_overlay: CanvasLayer = $ShopMenuOverlay
@onready var cg_overlay: CanvasLayer = $CgOverlay
@onready var tap_to_pay: CanvasLayer = $TapToPayOverlay
@onready var hud_overlay: CanvasLayer = $HudOverlay
@onready var message_popup: PanelContainer = $MessageLayer/MessagePopup
@onready var message_label: Label = $MessageLayer/MessagePopup/MessageMargin/MessageLabel

var portrait_map: Dictionary = {}
var npc_backgrounds: Dictionary = {}  # npc_name → background key
# Per-scene rotation counters for repeatable NPC lines (key → next index).
# Resets on scene load — only needs to vary within a visit, not persist.
var _repeat_rotation: Dictionary = {}
var map_width_px: int = 0
var map_height_px: int = 0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		# Dev hotkey: Shift+R resets all narrative state to a fresh Day 1 start.
		if event.keycode == KEY_R and event.shift_pressed:
			GameManager.reset_for_dev()
			DAY_DATA_DIR = "res://assets/days/day-01-home/"
			DAY_JSON = DAY_DATA_DIR + "day.json"
			get_tree().reload_current_scene()
		# DEV: Shift+C previews the Yamakawa onigiri cinematic; Shift+V the
		# Rikizo drink cinematic. Temporary — real triggers are the Day 7
		# onigiri-quest resolution + the inventory water "drink" button.
		elif event.keycode == KEY_C and event.shift_pressed:
			cg_overlay.play(
				"konbini-outside",
				"res://assets/cg/cg-yamakawa-onigiri.png",
				"もぐもぐ",
				func(): GameManager.show_message({"jp": "おいしい！", "en": "Delicious!"}),
				"rice", "chew"
			)
		elif event.keycode == KEY_V and event.shift_pressed:
			cg_overlay.play(
				"",  # "" = float over a dim wash; real use passes the area's bg key
				"res://assets/cg/cg-rikizo-drink.png",
				"ごくごく",
				func(): GameManager.show_message({"jp": "ふう。", "en": "Phew."}),
				"water", "gulp"
			)
		# DEV: Shift+B previews the Rikizo soda cinematic. Real trigger is the
		# inventory soda "drink" button.
		elif event.keycode == KEY_B and event.shift_pressed:
			cg_overlay.play(
				"",
				"res://assets/cg/cg-rikizo-soda.png",
				"ごくごく",
				func(): GameManager.show_message({"jp": "ふう。", "en": "Phew."}),
				"water", "gulp"
			)
		# DEV: Shift+T previews the tap-to-pay overlay (¥150 sample). Real
		# trigger is the konbini shop UI's purchase action.
		elif event.keycode == KEY_T and event.shift_pressed:
			tap_to_pay.play(
				150,
				"konbini-inside",
				func(): GameManager.show_message({"jp": "ありがとうございます！", "en": "Thank you!"})
			)
		# Dev-only keyboard shortcuts mirror the mobile HUD buttons. Same gate
		# applies: only work after the system is unlocked (i.e. at least one
		# item/quest exists, which only happens after the water pickup).
		# These are NOT meant to ship; on mobile + Switch the player taps the
		# HUD buttons exclusively.
		elif event.keycode == KEY_I and not event.shift_pressed:
			if inventory_overlay and (GameManager.has_phone or not GameManager.inventory.is_empty()):
				if inventory_overlay.visible:
					inventory_overlay.close_inventory()
				else:
					inventory_overlay.open_inventory()
				get_viewport().set_input_as_handled()
		elif event.keycode == KEY_Q and not event.shift_pressed:
			if quest_overlay and not GameManager.quests.is_empty():
				if quest_overlay.visible:
					quest_overlay.close_log()
				else:
					quest_overlay.open_log()
				get_viewport().set_input_as_handled()


func _ready() -> void:
	# Load supporting data first
	if FileAccess.file_exists(GLOSSARY_N5):
		GameManager.load_glossary(GLOSSARY_N5)
	if FileAccess.file_exists(PARTICLES):
		GameManager.load_particles(PARTICLES)
	if FileAccess.file_exists(CHARACTERS):
		GameManager.load_characters(CHARACTERS)
	if FileAccess.file_exists(CONJ_RULES):
		GameManager.load_conjugation_rules(CONJ_RULES)
	if FileAccess.file_exists(COUNTER_RULES):
		GameManager.load_counter_rules(COUNTER_RULES)
	GameManager.build_surface_index()

	# Load day data — RESUME into the last scene the player was in (recorded
	# on autosave / quit) instead of always reverting to the bedroom. A fresh
	# game (empty current_scene_id) starts at day-01-home as before.
	var _resume_id: String = GameManager.current_scene_id
	var _can_resume: bool = _resume_id != "" and ResourceLoader.exists("res://assets/days/%s/day.json" % _resume_id)
	if _can_resume:
		DAY_DATA_DIR = "res://assets/days/%s/" % _resume_id
		DAY_JSON = DAY_DATA_DIR + "day.json"
	GameManager.load_day(DAY_JSON)
	_build_world(GameManager.day_data)
	if _can_resume:
		# Drop the player exactly where they left off (overrides day.json
		# playerStart), with a brief lockout so a buffered tap doesn't
		# immediately fire a nearby exit/interaction.
		player.global_position = Vector2(GameManager.resume_x, GameManager.resume_y)
		GameManager.lock_interaction(400)
	else:
		# Fresh new game → play the cosmic opening sequence ONCE over Day 1
		# (which has already built underneath the white overlay). Freeze the
		# player via in_conversation for the duration; the overlay consumes taps
		# and dissolves into Day 1 when it ends. After the first autosave,
		# current_scene_id is set, so resume skips this on later launches.
		var intro := get_node_or_null("IntroOverlay")
		if intro:
			GameManager.in_conversation = true
			intro.play(func(): GameManager.in_conversation = false)

	# Persist on quit/background + a periodic autosave, so the resume point
	# survives even when no state-change save happened to fire.
	get_tree().auto_accept_quit = false
	var autosave := Timer.new()
	autosave.wait_time = 8.0
	autosave.autostart = true
	autosave.timeout.connect(func(): GameManager._save())
	add_child(autosave)

	# Wire up signals
	player.interaction_requested.connect(_on_player_interact)
	GameManager.message_shown.connect(_on_message_shown)
	GameManager.day_advanced.connect(_on_day_advanced)

	# HUD buttons → overlays. Once has_phone is set, HudOverlay swaps the
	# Inventory/Quest buttons for a single Phone button (PhoneOverlay
	# launches both apps from its home screen).
	if hud_overlay:
		hud_overlay.on_open_inventory = func(): inventory_overlay.open_inventory()
		hud_overlay.on_open_quests    = func(): quest_overlay.open_log()
		hud_overlay.on_open_phone     = func(): phone_overlay.open_phone()
	if inventory_overlay:
		# Water "drink" button → close inventory, play the drink cinematic
		# over the current location's bg, then complete the quest + consume
		# the bottle.
		inventory_overlay.on_use_water = func():
			inventory_overlay.close_inventory()
			cg_overlay.play(
				"",  # dim wash — reads cleanly regardless of where the player is
				"res://assets/cg/cg-rikizo-drink.png",
				"ごくごく",
				func():
					GameManager.complete_quest("drink_water")
					GameManager.remove_item("water_bottle")
					GameManager.show_message({"jp": "ふう。おいしい水でした。", "en": "Phew. That was good water."}),
				"water", "gulp"
			)
		# Soda "drink" button → same flow as water, minus the quest (soda has
		# no quest of its own). Close inventory, play the soda cinematic over
		# the current location's bg, then consume one can.
		inventory_overlay.on_use_soda = func():
			inventory_overlay.close_inventory()
			cg_overlay.play(
				"",  # dim wash — reads cleanly regardless of where the player is
				"res://assets/cg/cg-rikizo-soda.png",
				"ごくごく",
				func():
					GameManager.remove_item("soda", 1)
					GameManager.show_message({"jp": "ふう。つめたいソーダでした。", "en": "Phew. That was cold soda."}),
				"water", "gulp"
			)
		# Onigiri "eat" button → close inventory, play the greedy-bite CG
		# over the current location's bg, then resolve onigiri_quest (first
		# time only) + decrement one onigiri from the stack. Repeat eats
		# play the CG again but the quest is already complete so the
		# complete_quest call is a no-op (it guards on status == open).
		inventory_overlay.on_use_onigiri = func():
			inventory_overlay.close_inventory()
			cg_overlay.play(
				"",  # dim wash — works in kitchen, street, konbini, anywhere
				"res://assets/cg/cg-rikizo-onigiri.png",
				"もぐもぐ",
				func():
					GameManager.complete_quest("onigiri_quest")
					GameManager.remove_item("onigiri", 1)
					GameManager.show_message({"jp": "おいしい！", "en": "Delicious!"}),
				"rice", "chew"
			)
		# Curry "eat" button → close inventory, play the curry eat-CG over a
		# dim wash, then consume one plate. Bought at the riverside stand
		# (Day 8+); no quest of its own.
		inventory_overlay.on_use_curry = func():
			inventory_overlay.close_inventory()
			cg_overlay.play(
				"",  # dim wash — eat it anywhere
				"res://assets/cg/cg-rikizo-curry.png",
				"もぐもぐ",
				func():
					GameManager.remove_item("curry", 1)
					GameManager.show_message({"jp": "おいしい！", "en": "Delicious!"}),
				"rice", "chew"
			)
	if phone_overlay:
		phone_overlay.on_open_inventory = func():
			phone_overlay.close_phone()
			inventory_overlay.open_inventory()
		phone_overlay.on_open_quests = func():
			phone_overlay.close_phone()
			quest_overlay.open_log()
		phone_overlay.on_open_wallet = func():
			phone_overlay.close_phone()
			wallet_overlay.open_wallet()
		phone_overlay.on_open_messages = func():
			phone_overlay.close_phone()
			messages_overlay.open_messages()
	if messages_overlay:
		messages_overlay.on_open_thread = func(contact_id):
			messages_overlay.close_messages()
			conversation_overlay.open_thread(contact_id)
	if conversation_overlay:
		conversation_overlay.on_back = func():
			messages_overlay.open_messages()
	# Force-open phone hook (e.g. Day 5 "new message" beat)
	GameManager.phone_force_open.connect(func():
		phone_overlay.open_phone()
		phone_overlay.vibrate()
		Input.vibrate_handheld(140)  # device haptic buzz (no-op on desktop)
	)

	# Hide message popup initially
	message_popup.visible = false


func _on_day_advanced(_new_day: int) -> void:
	## When the day counter ticks up, refresh the objects layer so items
	## with `appearsFromDay` <= current_day show up immediately.
	_refresh_objects()
	# Refresh weather too, in case the day flipped while standing in an outdoor scene.
	_apply_weather()


func _apply_weather() -> void:
	## Drive the screen-space WeatherOverlay from the current day's weather, gated
	## to outdoor scenes (interiors never rain). Called on every scene build and
	## on day change.
	var kind := GameManager.weather_for_day(GameManager.current_day)
	if not GameManager.is_outdoor(GameManager.current_scene_id):
		kind = "clear"
	var weather := get_node_or_null("WeatherOverlay")
	if weather:
		weather.set_weather(kind)
	if player:
		player.set_umbrella(kind == "rain")


func _refresh_objects() -> void:
	for c in objects_container.get_children():
		c.queue_free()
	var objects_array: Array = GameManager.day_data.get("objects", [])
	for obj_data in objects_array:
		# Day-gating: must mirror _build_world — skip objects whose
		# appearsFromDay is in the future OR whose appearsUntilDay has
		# already passed (e.g. cake disappears Day 7+ via appearsUntilDay:6).
		var appears_from: int = int(obj_data.get("appearsFromDay", 1))
		if appears_from > GameManager.current_day:
			continue
		var appears_until: int = int(obj_data.get("appearsUntilDay", 999))
		if appears_until < GameManager.current_day:
			continue
		if _object_removed_by_flag(obj_data):
			continue
		if _object_gated_by_flag(obj_data):
			continue
		if GameManager.picked_up.get(str(obj_data.get("name", "")), false):
			continue
		var obj_instance: Node = OBJECT_SCENE.instantiate()
		objects_container.add_child(obj_instance)
		obj_instance.set_meta("day_dir", DAY_DATA_DIR)
		obj_instance.setup(obj_data)


func _object_removed_by_flag(obj_data: Dictionary) -> bool:
	## Returns true iff `obj_data` has a `removedByFlag` string and the
	## named GameManager property is currently truthy. Used to hide map
	## objects after a story beat fires (e.g. the east river barrier
	## disappearing once told_about_yuki = true). The named flag must be
	## a real instance variable on GameManager (the same one that's
	## persisted in save/load); typos resolve to null → no removal.
	var flag_name: String = str(obj_data.get("removedByFlag", ""))
	if flag_name == "":
		return false
	var val = GameManager.get(flag_name)
	return bool(val) if val != null else false


func _object_gated_by_flag(obj_data: Dictionary) -> bool:
	## Inverse of removedByFlag: returns true iff `obj_data` has an
	## `appearsWhenFlag` string AND the named flag is NOT yet truthy —
	## i.e. the object should be HIDDEN because its gating flag hasn't
	## fired yet. Used for forward-gated objects like Exit_East on
	## day-06-river (the eastward path opens only after told_about_yuki).
	## Typos resolve to null → object stays gated (safest default).
	var flag_name: String = str(obj_data.get("appearsWhenFlag", ""))
	if flag_name == "":
		return false  # no gate → not gated
	var val = GameManager.get(flag_name)
	return not (bool(val) if val != null else false)


func transition_to_day(day_id: String, spawn_position: Vector2) -> void:
	## Switch the currently-loaded day to a different one.
	## Tears down the current world (chunks, NPCs, objects, collision walls)
	## then rebuilds from the new day.json. Player is positioned at spawn_position.
	DAY_DATA_DIR = "res://assets/days/%s/" % day_id
	DAY_JSON = DAY_DATA_DIR + "day.json"

	_clear_world()
	GameManager.load_day(DAY_JSON)
	_build_world(GameManager.day_data)

	# Override player spawn (replaces day.json's playerStart for transition use)
	player.global_position = spawn_position

	# Brief interaction lockout so a buffered or double-tapped interact press
	# (e.g. the one that triggered this transition) doesn't immediately fire
	# whatever's near the new spawn point — was causing players to skip the
	# yard and land on the street when leaving the house on Day 5+.
	GameManager.lock_interaction(400)


func _current_day_id() -> String:
	## Extract the day id (e.g. "day-09-konbini-gacha") from DAY_DATA_DIR
	## ("res://assets/days/day-09-konbini-gacha/") for resume bookkeeping.
	return DAY_DATA_DIR.trim_suffix("/").get_file()


func _process(_delta: float) -> void:
	# Keep the resume position fresh in memory so any save (state-change,
	# autosave, or quit) records exactly where the player is standing.
	if player:
		GameManager.resume_x = player.global_position.x
		GameManager.resume_y = player.global_position.y


func _notification(what: int) -> void:
	# Persist before the app closes / backgrounds so the resume point is saved
	# even when no gameplay event triggered a save. auto_accept_quit is off
	# (set in _ready), so we must quit ourselves after saving.
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		GameManager._save()
		get_tree().quit()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		GameManager._save()
		get_tree().quit()
	elif what == NOTIFICATION_APPLICATION_PAUSED:
		GameManager._save()


func _clear_world() -> void:
	## Free child nodes built by _build_world so the next _build_world starts clean.
	if map_chunks:
		for c in map_chunks.get_children():
			c.queue_free()
	map_sprite.texture = null
	map_sprite.visible = false
	for c in npcs_container.get_children():
		c.queue_free()
	for c in objects_container.get_children():
		c.queue_free()
	if collision_map and collision_map.has_method("clear_walls"):
		collision_map.clear_walls()
	# Tilemap-mode artifacts (Floor/Walls/WallColliders/Objects tilemap layers)
	# get added as siblings; remove any leftovers from previous loads.
	var protected := [map_sprite, map_chunks, collision_map, player, npcs_container, objects_container, dialogue_overlay, calendar_overlay, choice_overlay, inventory_overlay, quest_overlay, phone_overlay, wallet_overlay, messages_overlay, conversation_overlay, shop_menu_overlay, cg_overlay, tap_to_pay, hud_overlay, message_popup, $MessageLayer, $TouchControls, get_node_or_null("PhoneCaseSwapOverlay")]
	for child in get_children():
		if child not in protected:
			child.queue_free()


func _build_world(data: Dictionary) -> void:
	# Record which scene we're in so a quit/reload can resume here.
	GameManager.current_scene_id = _current_day_id()
	var assets: Dictionary = data.get("assets", {})

	# --- Decide map mode (checked in priority order) ---
	var map_cfg: Dictionary = {}
	var raw_map: Variant = assets.get("map", null)
	if raw_map is Dictionary:
		map_cfg = raw_map

	if map_cfg.has("chunks"):
		_build_chunked_map(map_cfg)
	elif assets.has("tileLayout"):
		_build_tilemap(assets)
	else:
		_build_legacy_map(assets)

	# --- Player speed ---
	# Home interior (day-01-home) keeps the base walk speed. Outdoor
	# chunks are physically much larger relative to the player sprite,
	# so a bump avoids the painful slow-traverse feel. Tweak the
	# multiplier value here to taste.
	if player:
		if DAY_DATA_DIR.find("day-01-home/") != -1:
			player.speed_multiplier = 1.0
		else:
			player.speed_multiplier = 1.35

	# --- Conversation Backgrounds ---
	var bg_map: Dictionary = assets.get("convoBackgrounds", {})
	for bg_key in bg_map:
		var bg_path := "res://assets/backgrounds/" + str(bg_map[bg_key]).get_file()
		if ResourceLoader.exists(bg_path):
			GameManager.convo_backgrounds[bg_key] = load(bg_path) as Texture2D

	# --- Weather (Day 11+) ---
	_apply_weather()

	# --- Alt Portraits ---
	var alt_map: Dictionary = data.get("altPortraits", {})
	for alt_key in alt_map:
		var alt_path := DAY_DATA_DIR + "characters/" + str(alt_map[alt_key]).get_file()
		if ResourceLoader.exists(alt_path):
			GameManager.alt_portraits[alt_key] = load(alt_path) as Texture2D

	# --- Player Start ---
	# Accept both {"x":..,"y":..} (legacy) and [x, y] (new painted map format)
	var start_data: Variant = data["playerStart"]
	if start_data is Array:
		player.global_position = Vector2(float(start_data[0]), float(start_data[1]))
	else:
		player.global_position = Vector2(float(start_data["x"]), float(start_data["y"]))

	# --- Player Sprite ---
	# day.json may specify `playerScale` (default 1.0) to enlarge or shrink
	# Rikizo on chunks whose painted bg uses a different real-world scale.
	# Konbini/Station were painted at ~2× the house-chunk scale, so Rikizo
	# needs a matching boost to read at the same chibi proportion as NPCs
	# placed on those chunks.
	var sheet_path := "res://assets/shared/sprites/me_sheet.png"
	if ResourceLoader.exists(sheet_path):
		var sheet_tex := load(sheet_path) as Texture2D
		var player_sprite: Sprite2D = player.get_node("Sprite2D")
		player_sprite.texture = sheet_tex
		player_sprite.region_enabled = true
		player_sprite.region_rect = Rect2(0, 0, 204, 293)
		var p_scale: float = float(data.get("playerScale", 1.0))
		var sx := (63.0 / 204.0) * p_scale
		var sy := (90.0 / 293.0) * p_scale
		player_sprite.scale = Vector2(sx, sy)
		player_sprite.offset = Vector2(0, -293.0 * 0.5)

	# --- Player conversation portrait ---
	if data.has("meConvoPortrait"):
		var me_portrait_file := str(data["meConvoPortrait"]).get_file()
		var me_portrait_path := DAY_DATA_DIR + "characters/" + me_portrait_file
		if ResourceLoader.exists(me_portrait_path):
			portrait_map[&"りきぞう"] = load(me_portrait_path)

	# --- NPCs ---
	var npcs_array: Array = data.get("npcs", [])
	for i in range(npcs_array.size()):
		var npc_data: Dictionary = npcs_array[i]
		# Day-gating: same appearsFromDay / appearsUntilDay convention as
		# objects. Lets us migrate NPCs (e.g., Yamakawa konbini → river).
		var npc_from: int = int(npc_data.get("appearsFromDay", 1))
		if npc_from > GameManager.current_day:
			continue
		var npc_until: int = int(npc_data.get("appearsUntilDay", 999))
		if npc_until < GameManager.current_day:
			continue
		var npc_instance: Node = NPC_SCENE.instantiate()
		npcs_container.add_child(npc_instance)

		var sprite_tex: Texture2D = null
		var portrait_tex: Texture2D = null
		var sprite_raw := str(npc_data.get("sprite", ""))
		var portrait_raw := str(npc_data.get("convoPortrait", ""))
		# Yamakawa post-onigiri-eat swap. day.json keeps him on the
		# WITH-onigiri art by default so the Day 7 first-meet at the
		# konbini shows him holding the rice ball. Once the eat-CG has
		# fired (yamakawa_ate_konbini flag flips), every subsequent
		# instantiation pulls the no-onigiri art instead.
		if str(npc_data.get("name", "")) == "yamakawa" and GameManager.yamakawa_ate_konbini:
			sprite_raw = "assets/days/day-05-konbini/characters/yamakawa_sprite.png"
			portrait_raw = "assets/days/day-05-konbini/characters/yamakawa_convo.png"
		var sprite_path := _resolve_npc_asset_path(sprite_raw)
		var portrait_path := _resolve_npc_asset_path(portrait_raw)

		if ResourceLoader.exists(sprite_path):
			sprite_tex = load(sprite_path) as Texture2D
		if ResourceLoader.exists(portrait_path):
			portrait_tex = load(portrait_path) as Texture2D
			portrait_map[npc_data["name"]] = portrait_tex

		# Store per-NPC background key
		if npc_data.has("convoBackground"):
			npc_backgrounds[npc_data["name"]] = npc_data["convoBackground"]

		npc_instance.setup(npc_data, sprite_tex, portrait_tex)
		npc_instance.proximity_entered.connect(_on_npc_proximity)

	# --- Interactive Objects ---
	var objects_array: Array = data.get("objects", [])
	for i in range(objects_array.size()):
		var obj_data: Dictionary = objects_array[i]
		# Day-gating: skip objects whose appearsFromDay is in the future,
		# OR whose appearsUntilDay has already passed. Defaults are wide
		# open so legacy entries always show.
		var appears_from: int = int(obj_data.get("appearsFromDay", 1))
		if appears_from > GameManager.current_day:
			continue
		var appears_until: int = int(obj_data.get("appearsUntilDay", 999))
		if appears_until < GameManager.current_day:
			continue
		# Story-flag-gating: skip objects removed by a GameManager flag
		# (e.g. east river barrier vanishes once told_about_yuki is true).
		if _object_removed_by_flag(obj_data):
			continue
		# Inverse story-flag-gating: skip objects that haven't been unlocked
		# yet (e.g. Exit_East on day-06-river only appears after the convo).
		if _object_gated_by_flag(obj_data):
			continue
		# Pickup-gating: skip objects the player has already taken into inventory.
		if GameManager.picked_up.get(str(obj_data.get("name", "")), false):
			continue
		var obj_instance: Node = OBJECT_SCENE.instantiate()
		objects_container.add_child(obj_instance)
		# Inject day dir so InteractiveObject can resolve day-relative sprite paths
		obj_instance.set_meta("day_dir", DAY_DATA_DIR)
		obj_instance.setup(obj_data)
		# Day 10 電気: restore the saved on/off sprite after a mid-day reload
		# (off is the default sprite from day.json; only TV/Lamp react).
		if GameManager.current_day >= 10 and obj_instance.obj_sprite:
			var _en := str(obj_data.get("name", ""))
			if _en == "TV" and GameManager.tv_on:
				obj_instance.obj_sprite.texture = load("res://assets/days/day-01-home/objects/tv_on.png") as Texture2D
			elif _en == "Lamp" and GameManager.lamp_on:
				obj_instance.obj_sprite.texture = load("res://assets/days/day-01-home/objects/lamp_on.png") as Texture2D

	# --- Camera Limits ---
	if map_width_px > 0 and map_height_px > 0:
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = map_width_px
		camera.limit_bottom = map_height_px
		# Edge collision walls so the player can't walk off-map past holes
		# in the painted collision mask. Added to objects_container so they
		# get cleared on day transition.
		_add_edge_walls(map_width_px, map_height_px)

	# --- Dialogue portrait map ---
	dialogue_overlay.set_portrait_map(portrait_map)

	# Catch-up: ensure Day 7+ quest verbs are filled even for saves that
	# advanced past Day 6 before this wiring existed. set_quest_verb is
	# idempotent (won't re-flag unread once set), so this is safe on every
	# load. The phone-buzz still only fires on the actual 6→7 advance.
	if GameManager.current_day >= 7:
		GameManager.set_quest_verb("onigiri_quest", "食べる", "Eat")
		GameManager.set_quest_verb("drink_water", "飲む", "Drink")


func _on_npc_proximity(npc) -> void:
	## Auto-trigger conversations that should fire just by walking near an
	## NPC (rather than requiring an interact press). Currently: Dad on
	## Day 4 forces the phone hand-off so the player can't skip it by
	## walking past. The in_conversation / has_phone guards keep it from
	## re-firing once the convo runs.
	if GameManager.in_conversation or GameManager.is_interaction_locked():
		return
	if npc.npc_name == "dad" and GameManager.current_day == 4 and not GameManager.has_phone:
		_handle_npc_interaction(npc)


func _resolve_npc_asset_path(p: String) -> String:
	## Resolve an NPC sprite / convoPortrait path. Supports cross-day paths
	## AND the legacy Day 1 convention where day.json sprite paths point at
	## a non-existent `assets/characters/<who>/<file>.png` but the actual
	## file lives in `<day_dir>/characters/<file>.png`.
	## Resolution order:
	##   1. "res://..." → used as-is.
	##   2. The explicit path (prepending res:// for "assets/..." etc.) —
	##      only if the file actually exists there.
	##   3. Fall back to the current day's characters folder using just
	##      the filename (legacy behavior).
	if p == "":
		return ""
	if p.begins_with("res://"):
		return p
	var explicit: String = p if p.begins_with("res://") else "res://" + p
	if not explicit.begins_with("res://"):
		explicit = "res://" + explicit
	if ResourceLoader.exists(explicit):
		return explicit
	# Fall back: day-relative chars folder using just the filename.
	return DAY_DATA_DIR + "characters/" + p.get_file()


func _add_edge_walls(w: int, h: int) -> void:
	var t := 64.0
	# [center, size] for N, S, W, E
	var sides: Array = [
		[Vector2(w * 0.5, -t * 0.5), Vector2(w + t * 2.0, t), "EdgeN"],
		[Vector2(w * 0.5, h + t * 0.5), Vector2(w + t * 2.0, t), "EdgeS"],
		[Vector2(-t * 0.5, h * 0.5), Vector2(t, h + t * 2.0), "EdgeW"],
		[Vector2(w + t * 0.5, h * 0.5), Vector2(t, h + t * 2.0), "EdgeE"],
	]
	for s in sides:
		var body := StaticBody2D.new()
		body.name = s[2]
		body.collision_layer = 128
		body.collision_mask = 0
		var shape := RectangleShape2D.new()
		shape.size = s[1]
		var col := CollisionShape2D.new()
		col.shape = shape
		body.add_child(col)
		body.position = s[0]
		objects_container.add_child(body)


# --- Painted chunked map mode (current production) ---

func _build_chunked_map(cfg: Dictionary) -> void:
	## Build a multi-chunk painted map from assets.map.chunks[] and assets.map.collision[].
	## Each entry has { file, x, y }. Files are resolved relative to the day folder.
	map_sprite.visible = false  # hide legacy single-image node

	if map_chunks == null:
		# Create MapChunks container on the fly if main.tscn hasn't been updated yet
		map_chunks = Node2D.new()
		map_chunks.name = "MapChunks"
		add_child(map_chunks)
		move_child(map_chunks, 0)

	# Build visual chunks
	var chunk_entries: Array = cfg.get("chunks", [])
	for entry in chunk_entries:
		var chunk_file: String = str(entry.get("file", ""))
		if chunk_file.is_empty():
			continue
		var chunk_path := DAY_DATA_DIR + chunk_file
		if not ResourceLoader.exists(chunk_path):
			push_warning("Chunk missing: " + chunk_path)
			continue
		var chunk_tex := load(chunk_path) as Texture2D
		var s := Sprite2D.new()
		s.texture = chunk_tex
		s.centered = false
		s.position = Vector2(float(entry.get("x", 0)), float(entry.get("y", 0)))
		s.name = "Chunk_%d_%d" % [int(entry.get("x", 0)), int(entry.get("y", 0))]
		map_chunks.add_child(s)

		# Foreground overlay layer — anything in <chunk>_fg.png (e.g.
		# overhead wires, awning fronts, fence tops) renders ABOVE sprites
		# so the player, NPCs, and objects appear to pass beneath it.
		# Convention: file name = chunk filename with "_fg" inserted before
		# the .png extension.
		var fg_file: String = chunk_file.replace(".png", "_fg.png")
		var fg_path: String = DAY_DATA_DIR + fg_file
		if ResourceLoader.exists(fg_path):
			var fg_tex := load(fg_path) as Texture2D
			var fg := Sprite2D.new()
			fg.texture = fg_tex
			fg.centered = false
			fg.position = Vector2(float(entry.get("x", 0)), float(entry.get("y", 0)))
			fg.z_index = 100  # above player, NPCs, objects (all default z=0)
			fg.name = "ChunkFG_%d_%d" % [int(entry.get("x", 0)), int(entry.get("y", 0))]
			map_chunks.add_child(fg)

	# Build collision masks
	var mask_entries: Array = cfg.get("collision", [])
	var masks: Array = []
	for mentry in mask_entries:
		var mask_file: String = str(mentry.get("file", ""))
		if mask_file.is_empty():
			continue
		var mask_path := DAY_DATA_DIR + mask_file
		if not ResourceLoader.exists(mask_path):
			push_warning("Collision mask missing: " + mask_path)
			continue
		var mask_tex := load(mask_path) as Texture2D
		masks.append({
			"texture": mask_tex,
			"offset": Vector2(float(mentry.get("x", 0)), float(mentry.get("y", 0))),
		})
	if masks.size() > 0:
		collision_map.build_from_textures(masks)

	# World dimensions (camera limits use these)
	map_width_px = int(cfg.get("width", 0))
	map_height_px = int(cfg.get("height", 0))
	if map_width_px <= 0 or map_height_px <= 0:
		# Derive from chunks if not specified
		var max_x := 0
		var max_y := 0
		for dentry in chunk_entries:
			var dpath := DAY_DATA_DIR + str(dentry.get("file", ""))
			if ResourceLoader.exists(dpath):
				var dtex := load(dpath) as Texture2D
				var ex := int(dentry.get("x", 0)) + dtex.get_width()
				var ey := int(dentry.get("y", 0)) + dtex.get_height()
				if ex > max_x: max_x = ex
				if ey > max_y: max_y = ey
		map_width_px = max_x
		map_height_px = max_y


# --- Legacy map mode (single map.png + collision.png) ---

func _build_legacy_map(assets: Dictionary) -> void:
	var map_path := DAY_DATA_DIR + str(assets.get("map", "map.png"))
	if ResourceLoader.exists(map_path):
		var map_tex := load(map_path) as Texture2D
		map_sprite.texture = map_tex
		map_sprite.centered = false
		map_width_px = map_tex.get_width()
		map_height_px = map_tex.get_height()

	var col_path := DAY_DATA_DIR + str(assets.get("collision", "collision.png"))
	if ResourceLoader.exists(col_path):
		var col_tex := load(col_path) as Texture2D
		collision_map.build_from_texture(col_tex)


# --- TileMap mode (tileLayout JSON + tileset) ---

func _build_tilemap(assets: Dictionary) -> void:
	# Hide legacy nodes
	map_sprite.visible = false
	collision_map.visible = false

	var tileset_name: String = assets.get("tileset", "house_interior")
	var layout: Dictionary = assets["tileLayout"]
	var tileset_path := "res://assets/shared/tilesets/" + tileset_name + ".tres"

	if not ResourceLoader.exists(tileset_path):
		push_warning("TileSet not found: " + tileset_path + " — falling back to legacy map")
		_build_legacy_map(assets)
		return

	var tile_set: TileSet = load(tileset_path) as TileSet
	var atlas_cols: int = 73  # house_interior.png is 73 columns wide

	# Build floor layer
	if layout.has("floor"):
		var floor_layer := TileMapLayer.new()
		floor_layer.tile_set = tile_set
		floor_layer.name = "Floor"
		floor_layer.z_index = -2
		var floor_data: Array = layout["floor"]
		for y in floor_data.size():
			var row: Array = floor_data[y]
			for x in row.size():
				var tile_id: int = int(row[x])
				if tile_id > 0:
					var atlas_x: int = tile_id % atlas_cols
					var atlas_y: int = tile_id / atlas_cols
					floor_layer.set_cell(Vector2i(x, y), 0, Vector2i(atlas_x, atlas_y))
		add_child(floor_layer)
		move_child(floor_layer, 0)

	# Build wall layer (visual only — collision added below)
	if layout.has("walls"):
		var wall_layer := TileMapLayer.new()
		wall_layer.tile_set = tile_set
		wall_layer.name = "Walls"
		wall_layer.z_index = -1
		var wall_data: Array = layout["walls"]
		for y in wall_data.size():
			var row: Array = wall_data[y]
			for x in row.size():
				var tile_id: int = int(row[x])
				if tile_id > 0:
					var atlas_x: int = tile_id % atlas_cols
					var atlas_y: int = tile_id / atlas_cols
					wall_layer.set_cell(Vector2i(x, y), 0, Vector2i(atlas_x, atlas_y))
		add_child(wall_layer)
		move_child(wall_layer, 1)

		# Add collision bodies for each wall cell
		var wall_colliders := Node2D.new()
		wall_colliders.name = "WallColliders"
		add_child(wall_colliders)
		for y in wall_data.size():
			var row: Array = wall_data[y]
			for x in row.size():
				var tile_id: int = int(row[x])
				if tile_id > 0:
					var body := StaticBody2D.new()
					body.position = Vector2(x * TILE_SIZE + TILE_SIZE * 0.5, y * TILE_SIZE + TILE_SIZE * 0.5)
					body.collision_layer = 1
					body.collision_mask = 1
					var shape := CollisionShape2D.new()
					var rect := RectangleShape2D.new()
					rect.size = Vector2(TILE_SIZE, TILE_SIZE)
					shape.shape = rect
					body.add_child(shape)
					wall_colliders.add_child(body)

	# Build objects/furniture layer (rendered on top of floor, below player)
	if layout.has("objects"):
		var obj_layer := TileMapLayer.new()
		obj_layer.tile_set = tile_set
		obj_layer.name = "Objects"
		obj_layer.z_index = 0
		var obj_data: Array = layout["objects"]
		for y in obj_data.size():
			var row: Array = obj_data[y]
			for x in row.size():
				var tile_id: int = int(row[x])
				if tile_id > 0:
					var atlas_x: int = tile_id % atlas_cols
					var atlas_y: int = tile_id / atlas_cols
					obj_layer.set_cell(Vector2i(x, y), 0, Vector2i(atlas_x, atlas_y))
		add_child(obj_layer)
		move_child(obj_layer, 2)

	# Calculate map dimensions from layout
	var any_layer: Array = layout.get("floor", layout.get("walls", []))
	if any_layer.size() > 0:
		var rows: int = any_layer.size()
		var cols: int = any_layer[0].size() if rows > 0 else 0
		map_width_px = cols * TILE_SIZE
		map_height_px = rows * TILE_SIZE


# --- Interaction Routing ---

func _on_player_interact() -> void:
	if GameManager.in_conversation:
		return
	if GameManager.is_interaction_locked():
		return

	var best_target: Variant = null
	var best_dist := INF
	var best_type := ""

	var facing_point: Vector2 = player.get_facing_point()

	# Check NPCs — each NPC has its OWN valid range (CollisionShape2D radius,
	# floored at 100). Candidate qualifies if within its range; closest valid
	# candidate wins overall.
	for npc in npcs_container.get_children():
		if not (npc is Area2D):
			continue
		var dist: float = player.global_position.distance_to(npc.global_position)
		var npc_max: float = 100.0
		var cs := npc.get_node_or_null("CollisionShape2D")
		if cs and cs.shape is CircleShape2D:
			npc_max = max(npc_max, cs.shape.radius)
		if dist > npc_max:
			continue
		if dist < best_dist:
			best_dist = dist
			best_target = npc
			best_type = "npc"

	# Check objects (use facing point distance to NEAREST EDGE of the object's
	# bounding box, not the center — so large objects like the tree can still
	# be interacted with even though their center is far from the player).
	for obj in objects_container.get_children():
		if not (obj is Area2D):
			continue
		# Skip non-interactive objects (placeholders that exist only for collision)
		if "interactive" in obj and not obj.interactive:
			continue
		# Skip disabled doors
		if obj.is_door and GameManager.is_door_disabled(obj.object_name):
			continue
		var half_w: float = obj.obj_width * 0.5
		var half_h: float = obj.obj_height * 0.5
		var dx: float = max(0.0, abs(facing_point.x - obj.global_position.x) - half_w)
		var dy: float = max(0.0, abs(facing_point.y - obj.global_position.y) - half_h)
		var dist: float = sqrt(dx * dx + dy * dy)
		# Priority bias: items sitting on top of a larger blocker (e.g. cake
		# on the kitchen counter) get priority>0 so they win selection ties
		# with the blocker. Multiplicative so a priority object far from the
		# player can't beat a closer NPC/object across the room — the bonus
		# only matters when the object is already in interaction range.
		var weighted: float = dist * (1.0 - 0.5 * float(obj.select_priority))
		# Objects retain the legacy 100px cap (NPCs are the ones with custom
		# radii via interactionRadius in day.json).
		if weighted > 100.0:
			continue
		if weighted < best_dist:
			best_dist = weighted
			best_target = obj
			best_type = "object"

	if best_target == null:
		return

	if best_type == "npc":
		_handle_npc_interaction(best_target)
	elif best_type == "object":
		_handle_object_interaction(best_target)


func _rotating_line(key: String, pool: Array) -> Dictionary:
	## Returns the next line from a small repeat pool, advancing a per-scene
	## counter so re-talking cycles through them (modulo) instead of repeating
	## one line forever. Resets on scene reload.
	var i: int = _repeat_rotation.get(key, 0)
	_repeat_rotation[key] = (i + 1) % pool.size()
	return pool[i]


func _handle_npc_interaction(npc) -> void:
	GameManager.inspected[npc.npc_name] = true
	# Relationship +1 per NPC per day (capped) — fires the first time Rikizo
	# starts ANY conversation with this NPC today.
	GameManager.bump_relationship(npc.npc_name)
	var convo: Array = npc.conversation
	var bg_key: String = npc_backgrounds.get(npc.npc_name, "")
	var options := {"background": bg_key}

	# Depaato worker (day-09-depaato-inside) — sells a single generic
	# present for ¥10,000, which fulfills the shopping_present quest Mom
	# gives on Day 8. ChoiceOverlay confirm → tap-to-pay → spend yen +
	# add the present to inventory + complete the quest. Guards for
	# already-bought and insufficient-funds. Runs through the convo
	# overlay so her portrait shows.
	if npc.npc_name == "depaato_worker":
		_handle_depaato_worker(options)
		return

	# Shopkeeper: Days 5-7 are window-shopping only (買う isn't taught yet,
	# so the menu opens display-only). Day 8+ the same menu becomes a
	# cart with stepper / totals / checkout, and checkout fires the
	# tap-to-pay cinematic + spends yen + adds items to inventory.
	if npc.npc_name == "shopkeeper":
		var konbini_items := _konbini_shop_items()
		if GameManager.current_day >= 8:
			# Buyable. Wire the cart callback BEFORE opening the menu so it
			# arms in the same frame as the menu appears.
			shop_menu_overlay.on_checkout = func(cart: Dictionary):
				_process_konbini_purchase(cart, konbini_items)
			options["on_end"] = func():
				shop_menu_overlay.open_menu(konbini_items)
			GameManager.start_conversation([
				{"speaker": "shopkeeper", "jp": "いらっしゃいませ！",        "en": "Welcome!"},
				{"speaker": "shopkeeper", "jp": "何がほしいですか？",        "en": "What would you like?"},
			], options)
		else:
			# Window-shopping (Day 5-7): open the menu without on_checkout
			# so the overlay renders in display-only mode.
			options["on_end"] = func():
				shop_menu_overlay.open_menu(konbini_items)
			GameManager.start_conversation([
				{"speaker": "shopkeeper", "jp": "いらっしゃいませ！", "en": "Welcome!"}
			], options)
		return

	# Day 10 — Yamakawa is back OUTSIDE the konbini (gacha exterior) and now
	# speaks CASUALLY (G9). First talk of the day = the register-shift scene
	# (the centerpiece); he trails off BEFORE the untaught 乗る verb (「電車は…」),
	# matching how everyone hints at words that don't exist yet. on_end seeds the
	# open-ended Appetite quest. Then: quest resolution (bring any new food,
	# e.g. curry), a one-time broken-word paranoia beat, and a refrain.
	if npc.npc_name == "yamakawa" and GameManager.current_day >= 10 \
			and DAY_DATA_DIR.find("day-09-konbini-gacha/") != -1:
		# Bring a NEW food (e.g. curry): Yamakawa eagerly eats it (eat CG), and
		# it joins his "tried" list — but the Appetite quest stays OPEN (he never
		# stops wanting new things). Tried foods show struck-through in the log.
		if GameManager.has_quest("yamakawa_appetite") and not GameManager.is_quest_complete("yamakawa_appetite") \
				and GameManager.has_item("curry"):
			var eat_curry := func():
				cg_overlay.play(
					"konbini-outside",
					"res://assets/cg/cg-yamakawa-curry.png",
					"もぐもぐ",
					func():
						GameManager.remove_item("curry", 1)
						GameManager.mark_yamakawa_food("カレー", "Curry")
						GameManager.show_message({"jp": "おいしい！でも、まだ...", "en": "Delicious! But... still..."}),
					"rice", "chew"
				)
			options["on_end"] = eat_curry
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "カレー！？", "en": "Curry!?"},
				{"speaker": "yamakawa", "jp": "新しい！ありがとう、りきぞう！", "en": "Something new! Thanks, Rikizo!"},
				{"speaker": "yamakawa", "jp": "いただきます！", "en": "Itadakimasu!"},
			], options)
			return
		var yk10 := "yamakawa_day%d" % GameManager.current_day
		if not GameManager.npc_day_talked.has(yk10):
			# First talk of Day 10 — the register shift.
			GameManager.npc_day_talked[yk10] = true
			options["on_end"] = func():
				GameManager.yamakawa_casual_day10 = true
				if not GameManager.has_quest("yamakawa_appetite"):
					GameManager.add_quest({"id": "yamakawa_appetite", "jp": "新しい食べ物をさがす", "en": "Find new food", "verb": null, "verb_en": null})
					GameManager.phone_force_open.emit()
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "よ、りきぞう！天気いいね！",         "en": "Yo, Rikizo! Nice weather, huh!"},
				{"speaker": "りきぞう",    "jp": "...え？",                         "en": "...Huh?"},
				{"speaker": "yamakawa", "jp": "ん？どうした？",                   "en": "Hm? What's up?"},
				{"speaker": "りきぞう",    "jp": "...うん、いい天気だね！",         "en": "...Yeah, nice weather!"},
				{"speaker": "yamakawa", "jp": "今日も休みだよ。いいね！",         "en": "Today's a day off too. Nice!"},
				{"speaker": "りきぞう",    "jp": "うん。でも...電車を見た？",       "en": "Yeah. But... did you see the train?"},
				{"speaker": "yamakawa", "jp": "電車？ああ、駅にあるね。でも、電車は...", "en": "The train? Oh yeah, it's at the station. But the train..."},
				{"speaker": "yamakawa", "jp": "...まあ、いいか。",                 "en": "...Well, whatever."},
				{"speaker": "yamakawa", "jp": "あ、新しいものがほしいな。",       "en": "Ah, I want something new."},
				{"speaker": "りきぞう",    "jp": "新しいもの？",                   "en": "Something new?"},
				{"speaker": "yamakawa", "jp": "うん！コンビニのおにぎりはもう毎日だよ。", "en": "Yeah! It's konbini onigiri every single day now."},
			], options)
			return
		# Repeat talks. First repeat after the scene: Rikizo picks up Yamakawa's
		# trailed-off train thought and Yamakawa can't complete it — a quiet
		# paranoia beat (once). Then the appetite refrain / reject existing food.
		if GameManager.yamakawa_casual_day10 and not GameManager.yamakawa_broken_word:
			GameManager.yamakawa_broken_word = true
			GameManager.increment_tracker("paranoia")
			GameManager.start_conversation([
				{"speaker": "りきぞう",    "jp": "やまかわ、電車は…？",           "en": "Yamakawa, the train...?"},
				{"speaker": "yamakawa", "jp": "ん？電車？…なんでもないよ。", "en": "Hm? The train? ...It's nothing."},
			], options)
			return
		if GameManager.has_item("onigiri"):
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "おにぎり？もう毎日だよ。", "en": "Onigiri? It's every day already."},
			], options)
			return
		GameManager.start_conversation([
			{"speaker": "yamakawa", "jp": "いい天気だね！新しい食べ物、ほしいなあ。", "en": "Nice weather! I want some new food."},
		], options)
		return


	# Yamakawa on Day 9 — tells Rikizo that Yuki is behind the depaato,
	# pointing him to the river path east. Fires the first time the player
	# talks to Yamakawa on Day 9+, in EITHER the outside konbini or the
	# inside konbini scene. Takes priority over Yamakawa's other Day 9
	# beats (the day-8 shopping-companion mode that would otherwise fire).
	# Setting told_about_yuki = true unlocks the east river barrier in a
	# downstream step (the Bollard_Chain_Vertical on day-06-river).
	if npc.npc_name == "yamakawa" and GameManager.current_day >= 9 \
			and not GameManager.told_about_yuki:
		options["on_end"] = func():
			GameManager.told_about_yuki = true
			GameManager._save()
		GameManager.start_conversation([
			{"speaker": "yamakawa", "jp": "りきぞう！",                                "en": "Rikizo!"},
			{"speaker": "りきぞう",    "jp": "やまかわ！",                              "en": "Yamakawa!"},
			{"speaker": "yamakawa", "jp": "ゆきさんはデパートの後ろにいますよ。",     "en": "Yuki-san is behind the depaato."},
			{"speaker": "りきぞう",    "jp": "ゆきさん？ほんとう？",                    "en": "Yuki-san? Really?"},
			{"speaker": "yamakawa", "jp": "はい！川に行ってください。",               "en": "Yes! Go to the river."},
			{"speaker": "りきぞう",    "jp": "ありがとう、やまかわ！",                  "en": "Thanks, Yamakawa!"},
		], options)
		return

	# Yamakawa back at the konbini on Day 7 — the eternal-onigiri payoff.
	# 食べる has landed, so he finally eats it: short lead-in convo →
	# cinematic CG (もぐもぐ). This is a NARRATIVE beat (closes the
	# share-refusal comedy thread), NOT the quest-completion path —
	# per the roadmap, おにぎりを食べる only completes when RIKIZO eats
	# HIS OWN onigiri from inventory on Day 8+ (after he buys one at
	# the konbini). Yamakawa eating his own doesn't count. The CG-
	# fired flag (yamakawa_ate_konbini) makes this fire once.
	if npc.npc_name == "yamakawa" and DAY_DATA_DIR.find("day-05-konbini/") != -1 \
			and GameManager.current_day >= 7 and not GameManager.yamakawa_ate_konbini:
		var eat_cg := func():
			cg_overlay.play(
				"konbini-outside",
				"res://assets/cg/cg-yamakawa-onigiri.png",
				"もぐもぐ",
				func():
					# CG finished — Yamakawa has eaten. Set the flag and
					# live-swap his sprite + convo portrait to the no-
					# onigiri art so the empty-handed state shows
					# immediately, without a chunk reload.
					GameManager.yamakawa_ate_konbini = true
					_swap_yamakawa_to_no_onigiri()
					GameManager.show_message({"jp": "おいしい！", "en": "Delicious!"}),
				"rice", "chew"
			)
		GameManager.start_conversation([
			{"speaker": "yamakawa", "jp": "りきぞう！おにぎりを食べます！", "en": "Rikizo! I'm going to eat the onigiri!"},
			{"speaker": "りきぞう",    "jp": "やっと！",                   "en": "Finally!"},
			{"speaker": "yamakawa", "jp": "あ、カレーも 食べます！",      "en": "Oh, I'll eat curry too!"},
			{"speaker": "yamakawa", "jp": "川に カレーやが ありますよ。",  "en": "There's a curry stand by the river."},
		], {"background": "konbini-outside", "on_end": eat_cg})
		return

	# Yamakawa at the konbini, Day 8+, with the onigiri quest already
	# resolved — he flips into shopping-companion mode: greets Rikizo,
	# recommends the (cheap) onigiri he refused to share two days ago,
	# and suggests juice. Zero memory, zero guilt, pure enthusiasm.
	# First-talk-of-day gets the full 4-line beat; repeats get the
	# one-line konbini loyalty refrain.
	if npc.npc_name == "yamakawa" and DAY_DATA_DIR.find("day-05-konbini/") != -1 \
			and GameManager.current_day >= 8 and GameManager.is_quest_complete("onigiri_quest"):
		var yk := "yamakawa_day%d" % GameManager.current_day
		if not GameManager.npc_day_talked.has(yk):
			GameManager.npc_day_talked[yk] = true
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "りきぞう！買い物ですか？",            "en": "Rikizo! Shopping?"},
				{"speaker": "りきぞう",    "jp": "はい！",                              "en": "Yes!"},
				{"speaker": "yamakawa", "jp": "いいですね。おにぎりは安いですよ。",   "en": "Nice. The onigiri is cheap."},
				{"speaker": "yamakawa", "jp": "ジュースもいいですよ。",              "en": "Juice is good too."},
			], options)
		else:
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "りきぞう、また来ましたか！コンビニはいいですよ。", "en": "Rikizo, you came again! The convenience store is great."},
			], options)
		return

	# Yamakawa on the river bank (Day 6+ migration) — takes precedence on
	# the river chunk so the player gets the river dialog regardless of
	# whether they met Yamakawa in the konbini first.
	if npc.npc_name == "yamakawa" and DAY_DATA_DIR.find("day-06-river/") != -1:
		# Treat the river visit as "meeting Yamakawa" too — adds the
		# おにぎりを＿＿ quest. Rikizo does NOT receive an onigiri (he can't
		# buy one until Day 8 when 買う lands); the quest resolves by
		# watching Yamakawa eat his on Day 7 at the konbini.
		if not GameManager.met_yamakawa:
			GameManager.met_yamakawa = true
			options["on_end"] = func():
				GameManager.add_quest({
					"id": "onigiri_quest",
					"jp": "おにぎりを%s",
					"en": "%s the onigiri",
					"verb": null,
					"verb_en": null,
				})
				# New-quest signal: pop the phone, shake it, red dot on Quests.
				GameManager.phone_force_open.emit()
		if not GameManager.met_yamakawa_river:
			GameManager.met_yamakawa_river = true
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "お、りきぞう！ここに来ましたか！",     "en": "Oh, Rikizo! You came here!"},
				{"speaker": "りきぞう",    "jp": "やまかわ！川ですね！",              "en": "Yamakawa! A river!"},
				{"speaker": "yamakawa", "jp": "いい川ですよ。毎日ここに来ます。",   "en": "Good river. I come here every day."},
				{"speaker": "りきぞう",    "jp": "水がきれいですね。",                "en": "The water is pretty."},
				{"speaker": "yamakawa", "jp": "山から来ますよ、この水は。",         "en": "This water comes from the mountains."},
				{"speaker": "yamakawa", "jp": "いいところですね。",                 "en": "Nice place, huh."},
			], options)
		else:
			GameManager.start_conversation([
				{"speaker": "yamakawa", "jp": "川はいいですね。",  "en": "The river's nice, isn't it."},
			], options)
		return

	# Ekicho (駅長 / station master) — Day 8+ NPC. First-meeting plays
	# the 4-line introduction (per the roadmap). After that, every
	# repeat talk falls through to his まだ refrain: a man whose entire
	# professional existence is organized around something that hasn't
	# happened yet. The first-talk reveal lands today's 古い (the 4-day-
	# old station "has always been old") and 長い (the road that the
	# player has walked end-to-end in seconds "is long"). The roadmap
	# notes him as the only NPC who says まだ rather than いつも.
	# Hotel front-desk CLERK (day-10-hotel-inside) — pure keigo service
	# composure. First talk lands today's 天気 small-talk + 人気/休日, and
	# drops the seed that "there's a guest today, too" (pointing the player
	# toward the becalmed man by the sofas). Repeats settle into a polite
	# いらっしゃいませ refrain.
	if npc.npc_name == "hotel_clerk":
		var clerk_key := "hotel_clerk_day%d" % GameManager.current_day
		if not GameManager.npc_day_talked.has(clerk_key):
			GameManager.npc_day_talked[clerk_key] = true
			GameManager.start_conversation([
				{"speaker": "hotel_clerk", "jp": "いらっしゃいませ。ホテルに ようこそ。",     "en": "Welcome. Welcome to the hotel."},
				{"speaker": "りきぞう",       "jp": "ホテルですか…きれいですね。",            "en": "A hotel… it's pretty."},
				{"speaker": "hotel_clerk", "jp": "ありがとうございます。今日は いい 天気ですね。", "en": "Thank you. The weather is nice today, isn't it."},
				{"speaker": "りきぞう",       "jp": "この ホテルは 人気ですか。",            "en": "Is this hotel popular?"},
				{"speaker": "hotel_clerk", "jp": "はい、休日は とても 人気ですよ。",         "en": "Yes, it's very popular on holidays."},
				{"speaker": "hotel_clerk", "jp": "今日も おきゃくさんが います。",           "en": "We have a guest today, too."},
			], options)
		else:
			GameManager.start_conversation([
				{"speaker": "hotel_clerk", "jp": "いらっしゃいませ。いい 天気ですね。", "en": "Welcome. Nice weather, isn't it."},
			], options)
		return

	# Hotel GUEST (day-10-hotel-inside) — the becalmed vacationer. Casual
	# register (から for "because", だからね), deflects the origin question
	# ("…just nearby"). On a LATER talk, Rikizo half-notices the man has no
	# bags — a one-time paranoia beat — before the holiday haze smooths it
	# over and he redirects to "…I feel good."
	if npc.npc_name == "hotel_guest":
		var guest_key := "hotel_guest_day%d" % GameManager.current_day
		if not GameManager.npc_day_talked.has(guest_key):
			GameManager.npc_day_talked[guest_key] = true
			GameManager.start_conversation([
				{"speaker": "hotel_guest", "jp": "あ、こんにちは。",                "en": "Oh, hello."},
				{"speaker": "りきぞう",       "jp": "こんにちは。ホテルに 来ましたか。",   "en": "Hello. Did you come to the hotel?"},
				{"speaker": "hotel_guest", "jp": "うん、休みだからね。",            "en": "Yeah, 'cause it's a holiday."},
				{"speaker": "hotel_guest", "jp": "天気が いいから、ここに 来ました。",  "en": "The weather's nice, so I came here."},
				{"speaker": "りきぞう",       "jp": "どこから 来ましたか。",           "en": "Where did you come from?"},
				{"speaker": "hotel_guest", "jp": "…ここの ちかくですよ。",          "en": "…Just nearby."},
			], options)
		elif not GameManager.hotel_guest_noticed:
			GameManager.hotel_guest_noticed = true
			GameManager.increment_tracker("paranoia")
			var guest_shock: Texture2D = GameManager.alt_portraits.get("meShocked")
			if guest_shock:
				options["portrait_overrides"] = {"りきぞう": guest_shock}
			GameManager.start_conversation([
				{"speaker": "りきぞう",       "jp": "…かばんが ない。",       "en": "…No bags."},
				{"speaker": "hotel_guest", "jp": "ん？",                 "en": "Hm?"},
				{"speaker": "りきぞう",       "jp": "…いいえ。気分が いいです。", "en": "…Never mind. I feel good."},
			], options)
		else:
			GameManager.start_conversation([
				{"speaker": "hotel_guest", "jp": "休みは いいですね。", "en": "Holidays are nice, aren't they."},
			], options)
		return

	if npc.npc_name == "ekicho":
		if not GameManager.met_ekicho:
			GameManager.met_ekicho = true
			GameManager.start_conversation([
				{"speaker": "ekicho",  "jp": "いらっしゃいませ。",         "en": "Welcome."},
				{"speaker": "りきぞう",  "jp": "駅長ですか？",               "en": "Are you the station master?"},
				{"speaker": "ekicho",  "jp": "はい。この駅は古い駅ですよ。", "en": "Yes. This is an old station."},
				{"speaker": "ekicho",  "jp": "長い道ですから。",           "en": "It's a long road, you see."},
			], options)
		elif GameManager.current_day == 9 and DAY_DATA_DIR.find("station-inside") != -1 \
				and not GameManager.npc_day_talked.has("ekicho_day9"):
			# Day 9: the 駅長 has moved INSIDE the station (中 unlocks the
			# interior on Day 9). He's still waiting — but he can't yet name
			# what for; the 電車 reveal is held for Day 10. The unease
			# deepens: he no longer even knows WHO is coming, echoing Yuki's
			# "...わかりません". First talk of Day 9 only; repeats fall through
			# to the refrain.
			GameManager.npc_day_talked["ekicho_day9"] = true
			GameManager.start_conversation([
				{"speaker": "ekicho", "jp": "お、りきぞうくん。今日も来ましたね。", "en": "Oh, Rikizo. You came today too."},
				{"speaker": "りきぞう", "jp": "駅長さん、中にいますね。",          "en": "Mr. Stationmaster — you're inside now."},
				{"speaker": "ekicho", "jp": "はい。ここは古い駅ですから。",      "en": "Yes. This is an old station, you see."},
				{"speaker": "ekicho", "jp": "でも、まだ来ません。",              "en": "But it still hasn't come."},
				{"speaker": "りきぞう", "jp": "だれが来ますか？",                  "en": "Who is coming?"},
				{"speaker": "ekicho", "jp": "...わかりません。",                 "en": "...I don't know."},
				{"speaker": "ekicho", "jp": "でも、毎日ここにいます。",          "en": "But I'm here every day."},
			], options)
		elif GameManager.current_day >= 10 and DAY_DATA_DIR.find("station-inside") != -1 \
				and not GameManager.npc_day_talked.has("ekicho_day10"):
			# Day 10: 電車 has arrived — the 駅長 can finally NAME what he's been
			# waiting on. The train is here… but it's on 休み (a holiday), like
			# everyone else this week. His まだ finally has an object, and still
			# doesn't resolve. First talk of Day 10; repeats fall to the refrain.
			GameManager.npc_day_talked["ekicho_day10"] = true
			GameManager.start_conversation([
				{"speaker": "ekicho", "jp": "お、りきぞうくん。電車を見ましたか？", "en": "Oh, Rikizo. Did you see the train?"},
				{"speaker": "りきぞう", "jp": "はい！電車がありますね！",          "en": "Yes! There's a train!"},
				{"speaker": "ekicho", "jp": "そうです。でも...まだですよ。",      "en": "That's right. But... not yet."},
				{"speaker": "りきぞう", "jp": "まだ...？",                         "en": "Not yet...?"},
				{"speaker": "ekicho", "jp": "電車は休みです。",                  "en": "The train is on holiday."},
				{"speaker": "りきぞう", "jp": "電車も、休み...",                   "en": "The train too... on holiday..."},
				{"speaker": "ekicho", "jp": "はい。毎日ここにいます。",          "en": "Yes. I'm here every day."},
			], options)
		else:
			# Repeat talks rotate through his まだ refrain so re-approaching
			# him isn't a single dead line. He's a man organized around
			# something that still hasn't come — and never names it (the 電車
			# reveal waits for Day 10).
			var n: int = int(GameManager.trackers.get("ekicho_talks", 0))
			GameManager.trackers["ekicho_talks"] = n + 1
			var ekicho_refrain := [
				[{"speaker": "ekicho", "jp": "まだですよ。",         "en": "Not yet."}],
				[{"speaker": "ekicho", "jp": "まだ来ませんね。",     "en": "It still hasn't come."}],
				[{"speaker": "ekicho", "jp": "長い道ですから。",     "en": "It's a long road, you see."}],
				[{"speaker": "ekicho", "jp": "今日も、まだですよ。", "en": "Today too — not yet."}],
			]
			GameManager.start_conversation(ekicho_refrain[n % ekicho_refrain.size()], options)
		return

	# Yamakawa first meeting — fires ONCE EVER, regardless of day. Plays
	# the 6-line first-meeting convo + the onigiri fragment crumble beat,
	# then adds the おにぎりを＿＿ quest with a blank verb (filled in once
	# 食べる lands). Rikizo does NOT receive an onigiri — he can't buy one
	# until Day 8 (買う). The quest resolves by watching Yamakawa eat his
	# at the Day 7 konbini.
	if npc.npc_name == "yamakawa" and not GameManager.met_yamakawa:
		GameManager.met_yamakawa = true
		options["on_end"] = func():
			GameManager.add_quest({
				"id": "onigiri_quest",
				"jp": "おにぎりを%s",
				"en": "%s the onigiri",
				"verb": null,
				"verb_en": null,
			})
			# New-quest signal: pop the phone, shake it, red dot on Quests.
			GameManager.phone_force_open.emit()
		GameManager.start_conversation([
			{"speaker": "yamakawa", "jp": "お、りきぞう！ここに来ましたか！",     "en": "Oh, Rikizo! You came here!"},
			{"speaker": "りきぞう",    "jp": "やまかわ！",                          "en": "Yamakawa!"},
			{"speaker": "yamakawa", "jp": "毎日ここに来ます。コンビニはいいですよ。", "en": "I come here every day. The convenience store is great."},
			{"speaker": "りきぞう",    "jp": "いつからですか？",                    "en": "Since when?"},
			{"speaker": "yamakawa", "jp": "いつから？...いつもですよ。",         "en": "Since when? ...Always."},
			{"speaker": "yamakawa", "jp": "また来てくださいね。",                "en": "Come again, okay?"},
			{"speaker": "yamakawa", "jp": "あ。",                                 "en": "Oh."},
			{"speaker": "りきぞう",    "jp": "おにぎり...",                         "en": "Onigiri..."},
		], options)
		return

	# Yamakawa post-first-meeting — same repeatable line every interaction,
	# regardless of day. Fires after met_yamakawa flips true (above).
	if npc.npc_name == "yamakawa":
		GameManager.start_conversation([
			{"speaker": "yamakawa", "jp": "りきぞう、また来ましたか！いいですね。", "en": "Rikizo, you came again! Nice."}
		], options)
		return

	# Day 2+ NPC dialogs — handle special branches (Mr. Tree, void-update) before fallthrough.
	if GameManager.current_day >= 2:
		# Mom: after Rikizo befriends Tree-san (which only happens on Days 2-4
		# via 3 examines), he tells Mom about Mr. Tree. Mom chides him that
		# a tree isn't a person — and ticks her annoyance up by one.
		# Gated to AFTER today's scripted morning initial has fired (so this
		# one-time beat never pre-empts the day-5/6/etc. morning convos —
		# it lands on a follow-up talk instead).
		if npc.npc_name == "mom" and GameManager.tree_san_unlocked and not GameManager.told_mom_tree \
				and GameManager.npc_day_talked.has("mom_day%d" % GameManager.current_day):
			GameManager.told_mom_tree = true
			GameManager.annoy("mom", "tree")
			# Swap mom's portrait to the exasperated alt for this beat.
			var exasperated_mom: Texture2D = GameManager.alt_portraits.get("momExasperated")
			if exasperated_mom:
				options["portrait_overrides"] = {"mom": exasperated_mom}
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "お母さん、木さんはともだちです！", "en": "Mom, Mr. Tree is my friend!"},
				{"speaker": "mom",   "jp": "木は人ではないですよ、りきぞう。",   "en": "A tree isn't a person, Rikizo."},
				{"speaker": "りきぞう", "jp": "...そうですか。",                    "en": "...Is that so."},
			], options)
			return
		# Dad: after Rikizo peeks at the void edge on Day 2, he asks Dad about it.
		# Dad insists the void has always been there. STRICTLY Day-2-only —
		# if Rikizo skips Dad on Day 2 he misses the beat for good.
		if npc.npc_name == "dad" and GameManager.current_day == 2 and GameManager.void_seen_day2 and not GameManager.told_dad_void_day2:
			GameManager.told_dad_void_day2 = true
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "お父さん、外の白いのは何ですか？", "en": "Dad, what's the white stuff outside?"},
				{"speaker": "dad",   "jp": "何もないです。いつもですよ。",       "en": "Nothing. It's always like that."},
				{"speaker": "りきぞう", "jp": "...そうですか。",                    "en": "...Is that so."},
			], options)
			return
		# Day 7 cake interrogation — flag-gated so it can span multiple
		# talks (ask → press → confess) rather than firing once per day.
		# With Tree-san befriended, Mom side-eyes and blames the tree on
		# the first ask; pressing makes her confess (exasperated). With no
		# tree friend she confesses outright on the first ask. Day-7-only:
		# if the player skipped Mom on Day 7 the cake moves on with her.
		if npc.npc_name == "mom" and GameManager.current_day == 7 and not GameManager.mom_cake_done:
			if not GameManager.mom_cake_asked and GameManager.tree_san_unlocked:
				GameManager.mom_cake_asked = true
				var sideeye: Texture2D = GameManager.alt_portraits.get("momScolding")
				if sideeye:
					options["portrait_overrides"] = {"mom": sideeye}
				GameManager.start_conversation([
					{"speaker": "りきぞう", "jp": "お母さん、ケーキは？",         "en": "Mom, the cake?"},
					{"speaker": "mom",   "jp": "ケーキ？...木さんが食べました。", "en": "The cake? ...Mr. Tree ate it."},
				], options)
			else:
				GameManager.mom_cake_done = true
				var exasp_mom: Texture2D = GameManager.alt_portraits.get("momExasperated")
				if exasp_mom:
					options["portrait_overrides"] = {"mom": exasp_mom}
				var confess := []
				if GameManager.mom_cake_asked:
					confess = [
						{"speaker": "りきぞう", "jp": "木さんは...食べません。",        "en": "Mr. Tree... doesn't eat."},
						{"speaker": "mom",   "jp": "...お母さんのケーキです。お母さんが食べました。", "en": "...It was Mom's cake. Mom ate it."},
					]
				else:
					confess = [
						{"speaker": "りきぞう", "jp": "お母さん、ケーキは？",          "en": "Mom, the cake?"},
						{"speaker": "mom",   "jp": "お母さんのケーキです。お母さんが食べました。", "en": "It was Mom's cake. Mom ate it."},
					]
				GameManager.start_conversation(confess, options)
			return

		# Day 7 Dad: asks whether Rikizo has drunk water today. Live check
		# of the drink_water quest (completes when the player uses the
		# water bottle's 飲む button), so the answer reflects current state
		# on every talk. Day-7-only — miss-it-and-it's-gone, same as Mom's
		# cake interrogation. Day 8+ has its own Dad content.
		if npc.npc_name == "dad" and GameManager.current_day == 7:
			if GameManager.is_quest_complete("drink_water"):
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "今日、水を飲みましたか？", "en": "Did you drink water today?"},
					{"speaker": "りきぞう", "jp": "はい、飲みました！",       "en": "Yes, I drank it!"},
					{"speaker": "dad",   "jp": "いいですね。",             "en": "Good."},
				], options)
			else:
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "今日、水を飲みましたか？",   "en": "Did you drink water today?"},
					{"speaker": "りきぞう", "jp": "いいえ、まだです。",         "en": "No, not yet."},
					{"speaker": "dad",   "jp": "水を飲んでくださいね。",     "en": "Please drink water, okay?"},
				], options)
			return

		# Day 9+: handing Dad the depaato present. Fires on ANY talk (not
		# gated to first-of-day) so the player can give it whenever they're
		# carrying it. Consumes the present + sets gave_dad_present, which
		# switches Dad/Mom to their post-present lines.
		if npc.npc_name == "dad" and GameManager.has_item("present") \
				and not GameManager.gave_dad_present:
			options["on_end"] = func():
				GameManager.remove_item("present")
				GameManager.gave_dad_present = true
				GameManager._save()
			var give_convo := []
			if GameManager.tree_san_unlocked:
				# High tree-relationship: Rikizo credits Mr. Tree for the gift,
				# and Mom — who has heard this one too many times — yells from
				# the kitchen off-screen (no portrait line).
				give_convo.append({"speaker": "りきぞう", "jp": "お父さん、プレゼントです。", "en": "Dad, a present."})
				give_convo.append({"speaker": "dad",   "jp": "え、ぼくに？", "en": "Huh, for me?"})
				give_convo.append({"speaker": "りきぞう", "jp": "はい！木さんからです。", "en": "Yes! It's from Mr. Tree."})
				give_convo.append({"speaker": "dad",   "jp": "...木さん？", "en": "...Mr. Tree?"})
				give_convo.append({"speaker": "", "jp": "お母さん：「りきぞう！木は 人じゃ ないですよ！」", "en": "Mom (from the kitchen): \"Rikizo! A tree isn't a person!\""})
				give_convo.append({"speaker": "りきぞう", "jp": "...はい。", "en": "...Yes."})
				give_convo.append({"speaker": "dad",   "jp": "...ありがとう、りきぞう。", "en": "...Thank you, Rikizo."})
				give_convo.append({"speaker": "dad",   "jp": "車も うれしいですよ。", "en": "The car is happy too."})
			else:
				give_convo.append({"speaker": "りきぞう", "jp": "お父さん、プレゼントです。", "en": "Dad, a present."})
				give_convo.append({"speaker": "dad",   "jp": "え、ぼくに？", "en": "Huh, for me?"})
				give_convo.append({"speaker": "りきぞう", "jp": "はい！", "en": "Yes!"})
				give_convo.append({"speaker": "dad",   "jp": "...ありがとう、りきぞう。", "en": "...Thank you, Rikizo."})
				give_convo.append({"speaker": "dad",   "jp": "うれしいです。", "en": "I'm happy."})
				give_convo.append({"speaker": "dad",   "jp": "...車もうれしいですよ。", "en": "...The car is happy too."})
			GameManager.start_conversation(give_convo, options)
			return

		var day_key := "%s_day%d" % [npc.npc_name, GameManager.current_day]
		if not GameManager.npc_day_talked.has(day_key):
			GameManager.npc_day_talked[day_key] = true
			if GameManager.current_day == 2 and npc.npc_name == "mom":
				convo = [
					{"speaker": "mom",   "jp": "りきぞう、今日は何ようびですか？", "en": "Rikizo, what day of the week is it today?"},
					{"speaker": "りきぞう", "jp": "えっと...",                          "en": "Umm..."},
					{"speaker": "mom",   "jp": "毎日、カレンダーを見てね。",       "en": "Check the calendar every day, okay?"},
					{"speaker": "mom",   "jp": "いい先生は毎日がんばるよ。",       "en": "A good teacher works hard every day."},
				]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 3 and npc.npc_name == "mom":
				# Mom talks about the 4-person family but trails off because
				# the big brother is implied but unnamed yet.
				# Mom's portrait stays NORMAL through the setup lines.
				# If Tree-san is unlocked, Rikizo offers Tree as the 4th and
				# only THEN does mom's portrait swap to exasperated for the
				# chide line (per-line override).
				var base := [
					{"speaker": "mom",   "jp": "わたしたちは4人かぞくですね。", "en": "We're a four-person family, right?"},
					{"speaker": "mom",   "jp": "お父さん、わたし、りきぞう、と...", "en": "Dad, me, Rikizo, and..."},
					{"speaker": "mom",   "jp": "...",                          "en": "..."},
				]
				if GameManager.tree_san_unlocked:
					GameManager.annoy("mom", "tree_family")
					var exasp: Texture2D = GameManager.alt_portraits.get("momExasperated")
					var chide_line: Dictionary = {
						"speaker": "mom",
						"jp": "りきぞう！木は人ではないですよ！",
						"en": "Rikizo! A tree isn't a person!",
					}
					if exasp:
						chide_line["portrait"] = exasp
					convo = base + [
						{"speaker": "りきぞう", "jp": "木さんですか？", "en": "Is it Mr. Tree?"},
						chide_line,
					]
				else:
					convo = base + [
						{"speaker": "mom", "jp": "...いいえ、なんでもないです。", "en": "...No, never mind."},
					]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 4 and npc.npc_name == "mom":
				# Day 4: the cake. Mom claims it. All of it. Including the half.
				convo = [
					{"speaker": "mom",   "jp": "りきぞう、このケーキはお母さんのですよ。", "en": "Rikizo, this cake is Mom's."},
					{"speaker": "りきぞう", "jp": "...半分は？",                            "en": "...Half?"},
					{"speaker": "mom",   "jp": "半分もお母さんのです。",                 "en": "The half is also Mom's."},
					{"speaker": "りきぞう", "jp": "...",                                    "en": "..."},
				]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 5 and npc.npc_name == "mom":
				# Day 5: Mom's send-off. te-form 来てください — first
				# conjugated verb from her, asking Rikizo to come home.
				convo = [
					{"speaker": "mom",   "jp": "りきぞう、今日はどこに行きますか？", "en": "Rikizo, where are you going today?"},
					{"speaker": "りきぞう", "jp": "店に行きます！",                  "en": "I'm going to the shops!"},
					{"speaker": "mom",   "jp": "家に来てくださいね。",            "en": "Come home, okay?"},
				]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 6 and npc.npc_name == "mom":
				# Day 6: Mom comments on the mountains that appeared
				# overnight, then her standard "come home" closer.
				convo = [
					{"speaker": "mom",   "jp": "今日は山がありますね。",   "en": "There are mountains today."},
					{"speaker": "mom",   "jp": "きれいですね。",           "en": "Pretty, aren't they."},
					{"speaker": "mom",   "jp": "家に来てくださいね。",    "en": "Come home, okay?"},
				]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 2 and npc.npc_name == "dad":
				convo = [
					{"speaker": "dad",   "jp": "りきぞう、今日もいい子ですね。",      "en": "Rikizo, you're a good kid today too."},
					{"speaker": "りきぞう", "jp": "お父さん、あれは何ですか？",        "en": "Dad, what's that?"},
					{"speaker": "dad",   "jp": "金です。お父さんの金です。",        "en": "Gold. Dad's gold."},
					{"speaker": "dad",   "jp": "...だめですよ。",                    "en": "...Don't even think about it."},
				]
				GameManager.start_conversation(convo, options)
				return
			elif GameManager.current_day == 3 and npc.npc_name == "dad":
				# Dad gives Rikizo money from teaching. The yen is added on
				# conversation end so the popup confirms the new total.
				var amount := 1000
				options["on_end"] = func():
					GameManager.add_yen(amount, "お父さん")
					GameManager.show_message({
						"jp": "¥%d をもらいました。" % amount,
						"en": "Got ¥%d." % amount,
					})
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、お金です。",         "en": "Rikizo, money."},
					{"speaker": "dad",   "jp": "せんせいのお金です。",       "en": "Teaching money."},
					{"speaker": "りきぞう", "jp": "ありがとう、お父さん！",     "en": "Thank you, Dad!"},
				], options)
				return
			elif GameManager.current_day == 4 and npc.npc_name == "dad" and not GameManager.has_phone:
				# Day 4: Dad returns the (repaired) smartphone. After this
				# convo ends, has_phone flips on — HUD folds Inventory+Quest
				# into a single Phone button and the phone overlay becomes
				# the player's primary UI hub.
				options["on_end"] = func():
					# Flip has_phone — InventoryOverlay's synthetic phone
					# tile + HudOverlay's phone button both auto-show when
					# this is true, both reading the equipped case sprite.
					GameManager.has_phone = true
					GameManager.show_message({
						"jp": "スマホをもらいました。",
						"en": "Got the smartphone.",
					})
					# Notify HUD + inventory to re-render the phone surfaces.
					GameManager.inventory_changed.emit()
					GameManager.phone_case_changed.emit()
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、ちょっと。",                     "en": "Rikizo, a moment."},
					{"speaker": "dad",   "jp": "これはりきぞうのスマホですよ。",           "en": "This is Rikizo's smartphone."},
					{"speaker": "りきぞう", "jp": "スマホ！？",                              "en": "A smartphone!?"},
					{"speaker": "dad",   "jp": "日本語のお金はすぐスマホです。分かりますか？", "en": "The Japanese[-lesson] money goes straight to the phone. Understand?"},
					{"speaker": "りきぞう", "jp": "分かります！",                           "en": "I understand!"},
					{"speaker": "dad",   "jp": "今週は大切ですよ。",                     "en": "This week is important."},
				], options)
				return
			elif GameManager.current_day == 5 and npc.npc_name == "dad":
				# Day 5: Dad's "Going Out" beat. First conjugated verbs
				# (行きます), plus a paranoid reminder that the gold is off
				# limits — だめ formally available now per N5.5.
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、どこに行きますか？",         "en": "Rikizo, where are you going?"},
					{"speaker": "りきぞう", "jp": "外に行きます！",                     "en": "I'm going outside!"},
					{"speaker": "dad",   "jp": "店に行きますか？",                   "en": "Going to the shops?"},
					{"speaker": "dad",   "jp": "だめですよ、金は...だめです。",      "en": "Don't... the gold is off limits."},
				], options)
				return
			elif GameManager.current_day == 6 and npc.npc_name == "dad":
				# Day 6: Dad's car has materialized in the yard. He
				# introduces it + immediately stakes his claim. NO
				# warning about going on the road — the car gag is now
				# a text-message-based one. First time Dad uses わたしの
				# (about anything).
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、外に車がありますね。",     "en": "Rikizo, there's a car outside."},
					{"speaker": "りきぞう", "jp": "車...？",                           "en": "A car...?"},
					{"speaker": "dad",   "jp": "わたしの車です。",                  "en": "It's MY car."},
					{"speaker": "dad",   "jp": "だめですよ、車は...だめです。",     "en": "Don't... the car is off limits."},
				], options)
				return
			elif GameManager.current_day == 8 and npc.npc_name == "mom":
				# Day 8 morning: shopping prompt + the day's anchor quest.
				# Quest resolves on Day 9 once 中 unlocks the デパート interior
				# (the only place that sells プレゼント).
				options["on_end"] = func():
					GameManager.add_quest({
						"id": "shopping_present",
						"jp": "プレゼントを%s",
						"en": "%s a present (for Dad)",
						"verb": "買う",
						"verb_en": "Buy",
					})
					# Phone buzz + red dot on the Quests tile.
					GameManager.phone_force_open.emit()
				GameManager.start_conversation([
					{"speaker": "mom",   "jp": "りきぞう、今日は買い物に行きますか？", "en": "Rikizo, are you going shopping today?"},
					{"speaker": "りきぞう", "jp": "はい！",                              "en": "Yes!"},
					{"speaker": "mom",   "jp": "お金はありますか？",                  "en": "Do you have money?"},
					{"speaker": "りきぞう", "jp": "はい、あります！",                    "en": "Yes, I do!"},
					{"speaker": "mom",   "jp": "高いものは買わないでくださいね。",     "en": "Don't buy expensive things, okay?"},
					{"speaker": "mom",   "jp": "あ、お父さんのプレゼントを買ってきてください。", "en": "Oh, please go buy a present for Dad."},
					{"speaker": "りきぞう", "jp": "はい、わかりました！",                "en": "Yes, understood!"},
				], options)
				return
			elif GameManager.current_day == 8 and npc.npc_name == "dad":
				# Day 8: Dad — uncharacteristically — volunteers intel. He
				# met the new 駅長 at the station and chatted about cars.
				# This is how the player learns the station has a person
				# today. Dad then snaps back to his eternal car monologue,
				# now with the new 新しい adjective permanently applied.
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、駅に駅長がいますよ。",         "en": "Rikizo, there's a station master at the station."},
					{"speaker": "dad",   "jp": "車の話をしました。",                   "en": "We talked about cars."},
					{"speaker": "dad",   "jp": "いい人です。",                         "en": "Good person."},
					{"speaker": "dad",   "jp": "...車はいいですよ。新しい車です。",     "en": "...Cars are good. It's a new car."},
				], options)
				return
			elif GameManager.current_day == 9 and npc.npc_name == "mom":
				if GameManager.is_quest_complete("shopping_present"):
					# Present bought — Mom is pleased (post-purchase follow-up).
					GameManager.start_conversation([
						{"speaker": "mom",   "jp": "りきぞう、プレゼントを買いましたか？",       "en": "Rikizo, did you buy the present?"},
						{"speaker": "りきぞう", "jp": "はい、買いました！",                      "en": "Yes, I bought it!"},
						{"speaker": "mom",   "jp": "よかったです。お父さんもよろこびますよ。", "en": "Wonderful. Dad will be happy too."},
					], options)
				else:
					# Pre-present nudge — points Rikizo at the depaato.
					GameManager.start_conversation([
						{"speaker": "mom",   "jp": "りきぞう、おはよう。",                     "en": "Rikizo, good morning."},
						{"speaker": "mom",   "jp": "デパートでプレゼントを買ってくださいね。", "en": "Please buy the present at the depaato, okay?"},
						{"speaker": "りきぞう", "jp": "はい、行きます！",                       "en": "Yes, I'll go!"},
					], options)
				return
			elif GameManager.current_day == 9 and npc.npc_name == "dad":
				if GameManager.gave_dad_present:
					# Already received the present earlier today.
					GameManager.start_conversation([
						{"speaker": "dad",   "jp": "プレゼント、ありがとう。", "en": "Thanks for the present."},
						{"speaker": "dad",   "jp": "...車はいいですよ。",      "en": "...Cars are good."},
					], options)
				else:
					# Pre-present: Dad hasn't got it yet, none-the-wiser.
					GameManager.start_conversation([
						{"speaker": "dad",   "jp": "りきぞう、おはよう。",        "en": "Rikizo, good morning."},
						{"speaker": "dad",   "jp": "今日も出かけますか？",      "en": "Heading out today too?"},
						{"speaker": "りきぞう", "jp": "はい！",                    "en": "Yes!"},
						{"speaker": "dad",   "jp": "...車はいいですよ。",        "en": "...Cars are good."},
					], options)
				return
			elif GameManager.current_day == 10 and npc.npc_name == "mom":
				GameManager.start_conversation([
					{"speaker": "mom",   "jp": "おはよう、りきぞう。今日もいい天気ですね。", "en": "Good morning, Rikizo. Nice weather again today."},
					{"speaker": "りきぞう", "jp": "お母さん、今日は休みですか？",            "en": "Mom, is today a day off?"},
					{"speaker": "mom",   "jp": "うん、休みですよ。お父さんも休みです。",   "en": "Yes, it's a day off. Dad too."},
					{"speaker": "りきぞう", "jp": "休日ですね！いい気分です。",             "en": "A holiday! I feel good."},
					{"speaker": "mom",   "jp": "天気もいいですし、気分もいいですね。",     "en": "The weather's good and the mood's good too."},
					{"speaker": "mom",   "jp": "りきぞうは先生になりましたね。",            "en": "You've become a teacher, Rikizo."},
				], options)
				return
			elif GameManager.current_day == 10 and npc.npc_name == "dad":
				GameManager.start_conversation([
					{"speaker": "dad",   "jp": "りきぞう、電車を見ましたか？", "en": "Rikizo, did you see the train?"},
					{"speaker": "りきぞう", "jp": "電車ですか？駅に？",         "en": "A train? At the station?"},
					{"speaker": "dad",   "jp": "そうだよ。電車がありますよ。でも...", "en": "Yeah. There's a train. But..."},
					{"speaker": "りきぞう", "jp": "でも？",                     "en": "But?"},
					{"speaker": "dad",   "jp": "まだです。電車に...",         "en": "Not yet. The train..."},
				], options)
				return
		else:
			# Repeatable line on follow-up interactions — runs through the
			# conversation overlay (portrait + background) so it doesn't look
			# like an examine popup.
			if GameManager.current_day == 2 and npc.npc_name == "mom":
				GameManager.start_conversation([
					{"speaker": "mom", "jp": "今日もいい日ですね。", "en": "Today is a good day too."}
				], options)
				return
			if GameManager.current_day == 3 and npc.npc_name == "mom":
				GameManager.start_conversation([
					{"speaker": "mom", "jp": "今日もいい日ですね。", "en": "Today is a good day too."}
				], options)
				return
			if GameManager.current_day == 4 and npc.npc_name == "mom":
				# After the cake convo, Mom retreats to "the cake is mine"
				# energy on every follow-up. She does not relent.
				GameManager.start_conversation([
					{"speaker": "mom", "jp": "ケーキはお母さんのですよ。", "en": "The cake is Mom's, you know."}
				], options)
				return
			if GameManager.current_day == 5 and npc.npc_name == "mom":
				# Day 5 repeatable — gentle "come back" reminders that rotate
				# so re-talking doesn't loop one line.
				GameManager.start_conversation([
					_rotating_line("mom_rep_day5", [
						{"speaker": "mom", "jp": "また来てくださいね。",       "en": "Come back again, okay?"},
						{"speaker": "mom", "jp": "気をつけてね、りきぞう。",   "en": "Take care, Rikizo."},
						{"speaker": "mom", "jp": "店はどうでしたか？",         "en": "How were the shops?"},
					])
				], options)
				return
			if GameManager.current_day == 6 and npc.npc_name == "mom":
				# Day 6 repeatable — the mountains are the day's novelty; rotate
				# a couple of small observations (was previously missing, so
				# follow-up talks fell through to the generic greeting).
				GameManager.start_conversation([
					_rotating_line("mom_rep_day6", [
						{"speaker": "mom", "jp": "山がきれいですね。",     "en": "The mountains are pretty."},
						{"speaker": "mom", "jp": "家に来てくださいね。",   "en": "Come home, okay?"},
					])
				], options)
				return
			if GameManager.current_day == 8 and npc.npc_name == "mom":
				# Day 8 repeatable — nudges the shopping quest using もう
				# (one of today's new adverbs). The quest can't actually
				# complete today (デパート interior is gated to Day 9 / 中),
				# so the nudge persists across all repeat talks.
				GameManager.start_conversation([
					{"speaker": "mom", "jp": "プレゼント、もう買いましたか？", "en": "Have you bought the present yet?"}
				], options)
				return
			if GameManager.current_day == 8 and npc.npc_name == "dad":
				# Day 8 repeatable — Dad reasserts the newness of his car
				# every time he opens his mouth. 新しい has permanently
				# bonded to the car; nothing else can take its place.
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "車はいいですよ。新しい車です。", "en": "Cars are good. It's a new car."}
				], options)
				return
			if GameManager.current_day == 9 and npc.npc_name == "mom":
				# Day 9 repeatable — flips on whether the present is bought.
				if GameManager.is_quest_complete("shopping_present"):
					GameManager.start_conversation([
						{"speaker": "mom", "jp": "いいプレゼントですね。", "en": "It's a nice present."}
					], options)
				else:
					GameManager.start_conversation([
						{"speaker": "mom", "jp": "プレゼント、もう買いましたか？", "en": "Have you bought the present yet?"}
					], options)
				return
			if GameManager.current_day == 9 and npc.npc_name == "dad":
				# Day 9 repeatable — post-present he thanks; otherwise the
				# eternal car line.
				if GameManager.gave_dad_present:
					GameManager.start_conversation([
						{"speaker": "dad", "jp": "プレゼント、ありがとう。車はいいですよ。", "en": "Thanks for the present. Cars are good."}
					], options)
				else:
					GameManager.start_conversation([
						{"speaker": "dad", "jp": "車はいいですよ。新しい車です。", "en": "Cars are good. It's a new car."}
					], options)
				return
			if GameManager.current_day == 10 and npc.npc_name == "mom":
				GameManager.start_conversation([
					{"speaker": "mom", "jp": "休みはいいですね。天気もいいし、気分もいいし。", "en": "Holidays are nice. The weather's good, and the mood's good."}
				], options)
				return
			if GameManager.current_day == 10 and npc.npc_name == "dad":
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "車も電車も...まだです。", "en": "The car and the train... not yet."}
				], options)
				return
			if GameManager.current_day == 2 and npc.npc_name == "dad":
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "今日もいい子ですね。", "en": "You're a good kid today too."}
				], options)
				return
			if GameManager.current_day == 3 and npc.npc_name == "dad":
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "がんばってください。", "en": "Hang in there."}
				], options)
				return
			if GameManager.current_day == 4 and npc.npc_name == "dad":
				# Dad's vague time wisdom — repeatable. He never answers
				# his own question.
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "今、何時ですか？",       "en": "What time is it now?"},
					{"speaker": "dad", "jp": "...時々、時は大切です。", "en": "...Sometimes, time is important."},
				], options)
				return
			if GameManager.current_day == 5 and npc.npc_name == "dad":
				# Day 5+ repeatable — Dad asks the same question every day,
				# forever. That's how dads work.
				GameManager.start_conversation([
					{"speaker": "dad", "jp": "どこに行きますか？", "en": "Where are you going?"}
				], options)
				return

	# Yuki — first encounter, day 9+. The player has walked the river path
	# east past the day-9 barrier and found her behind the depaato. Yuki
	# is surprised to see Rikizo, then notices the void — the FIRST NPC
	# to acknowledge it. Marks her as already-void-asked so the standard
	# void-ask block below doesn't try to re-fire for her on later talks.
	#
	# The convo branches on Rikizo's paranoia rating: the more void
	# scenes he's seen leading up to this, the more visceral his
	# response. Threshold is paranoia >= 3 (3 of 4 known void sites by
	# day 9 = 75%). Tune the threshold here as more void events land.
	# Day 10 — Yuki on the platform, gazing down the line where the tracks run
	# off into nothing (her convoBackground is the tracks-void cutscene). First
	# platform talk = the gaze beat; repeats get a short refrain. Fires on the
	# platform regardless of prior meeting, and marks met_yuki + void_asked.
	if npc.npc_name == "yuki" and DAY_DATA_DIR.find("day-10-platform/") != -1:
		var yuki_shock: Texture2D = GameManager.alt_portraits.get("meShocked")
		if yuki_shock and not options.has("portrait_overrides"):
			options["portrait_overrides"] = {"りきぞう": yuki_shock}
		var yk := "yuki_day%d" % GameManager.current_day
		if not GameManager.npc_day_talked.has(yk):
			GameManager.npc_day_talked[yk] = true
			options["on_end"] = func():
				GameManager.met_yuki = true
				GameManager.void_asked["yuki"] = true
				GameManager.increment_tracker("paranoia")
				GameManager._save()
			GameManager.start_conversation([
				{"speaker": "yuki",   "jp": "あ...りきぞうくん。",            "en": "Ah... Rikizo."},
				{"speaker": "りきぞう", "jp": "ゆきさん。ここに いますね。",    "en": "Yuki-san. You're here."},
				{"speaker": "yuki",   "jp": "はい。きょうは、ここです。",     "en": "Yes. Today, I'm here."},
				{"speaker": "yuki",   "jp": "あの電車を 見ますか？",         "en": "Do you see that train?"},
				{"speaker": "りきぞう", "jp": "はい。大きい 電車ですね。",      "en": "Yes. It's a big train."},
				{"speaker": "yuki",   "jp": "でも...どこにも いきません。",    "en": "But... it doesn't go anywhere."},
				{"speaker": "りきぞう", "jp": "どこにも...？",                "en": "Nowhere...?"},
				{"speaker": "yuki",   "jp": "あそこを 見て。",              "en": "Look over there."},
				{"speaker": "りきぞう", "jp": "...白い。",                   "en": "...White."},
				{"speaker": "yuki",   "jp": "なにも ないです。",            "en": "There's nothing."},
				{"speaker": "yuki",   "jp": "電車は、どこにも いきません。",   "en": "The train goes nowhere."},
				{"speaker": "りきぞう", "jp": "ぼくも、見ます。",              "en": "I see it too."},
				{"speaker": "yuki",   "jp": "ふたりだけ、ですね。",          "en": "Just the two of us."},
				{"speaker": "yuki",   "jp": "こわいです...",               "en": "I'm scared..."},
				{"speaker": "りきぞう", "jp": "ゆきさん、だいじょうぶです。", "en": "Yuki-san, it's alright."},
				{"speaker": "りきぞう", "jp": "ぼくが いますから。", "en": "Because I'm here."},
				{"speaker": "yuki",   "jp": "...はい。", "en": "...Yes."},
				{"speaker": "yuki",   "jp": "りきぞうくんは、先生ですね。", "en": "You're a teacher, aren't you."},
				{"speaker": "りきぞう", "jp": "はい。先生です。", "en": "Yes. I'm a teacher."},
				{"speaker": "yuki",   "jp": "じゃあ、だいじょうぶですね。", "en": "Then... it's alright, isn't it."},
				{"speaker": "りきぞう", "jp": "...うん。",                   "en": "...Yeah."},
			], options)
		else:
			# Repeat — rotate quiet lines so re-approaching isn't a dead line.
			var n: int = int(GameManager.trackers.get("yuki_platform_talks", 0))
			GameManager.trackers["yuki_platform_talks"] = n + 1
			var yuki_refrain := [
				[{"speaker": "yuki", "jp": "あの電車は...どこにも いきません。", "en": "That train... goes nowhere."}],
				[{"speaker": "yuki", "jp": "白いです。まだ、白いです。",         "en": "It's white. Still white."}],
				[{"speaker": "yuki", "jp": "ふたりだけ、見ますね。",            "en": "Only the two of us see it."}],
			]
			GameManager.start_conversation(yuki_refrain[n % yuki_refrain.size()], options)
		return


	if npc.npc_name == "yuki" and not GameManager.met_yuki:
		var yuki_shocked: Texture2D = GameManager.alt_portraits.get("meShocked")
		var yuki_opts := {"background": "void"}
		if yuki_shocked:
			yuki_opts["portrait_overrides"] = {"りきぞう": yuki_shocked}
		yuki_opts["on_end"] = func():
			GameManager.met_yuki = true
			GameManager.void_asked["yuki"] = true
			GameManager._save()
		var paranoia_rating: int = int(GameManager.trackers.get("paranoia", 0))
		var yuki_lines: Array
		if paranoia_rating >= 3:
			# HIGH paranoia — Rikizo has been alone with this for too
			# long. The relief of someone else finally seeing it spills
			# out before the social niceties. Less small-talk, more
			# desperation, terse fragments.
			yuki_lines = [
				{"speaker": "yuki",   "jp": "あ！りきぞうくん！？",         "en": "Ah! Rikizo!?"},
				{"speaker": "りきぞう", "jp": "ゆきさん！あれ！",            "en": "Yuki! That!"},
				{"speaker": "yuki",   "jp": "あれ...？",                    "en": "That...?"},
				{"speaker": "りきぞう", "jp": "あれを見ますか！？",          "en": "Do you see that!?"},
				{"speaker": "yuki",   "jp": "白いです...見ますよ...",       "en": "It's white... I see it..."},
				{"speaker": "りきぞう", "jp": "！！",                          "en": "!!"},
				{"speaker": "りきぞう", "jp": "ぼくも見ます！ゆきさん！",    "en": "I see it too! Yuki!"},
				{"speaker": "yuki",   "jp": "りきぞうくん...こわいです...",   "en": "Rikizo... I'm scared..."},
				{"speaker": "りきぞう", "jp": "ぼくもです...ふたりだけ...",   "en": "Me too... just the two of us..."},
				{"speaker": "yuki",   "jp": "...わかりません...",            "en": "...I don't know..."},
			]
		else:
			# Normal — Rikizo hasn't seen enough of the void to be wound
			# up about it. Polite greetings first, void emerges into the
			# convo organically.
			yuki_lines = [
				{"speaker": "yuki",   "jp": "あ！りきぞうくん！？",         "en": "Ah! Rikizo!?"},
				{"speaker": "りきぞう", "jp": "ゆきさん！",                   "en": "Yuki!"},
				{"speaker": "yuki",   "jp": "ここに...？",                   "en": "...Here?"},
				{"speaker": "りきぞう", "jp": "やまかわが...",                "en": "Yamakawa..."},
				{"speaker": "yuki",   "jp": "あ...",                          "en": "Ah..."},
				{"speaker": "yuki",   "jp": "りきぞうくん、あれ...",           "en": "Rikizo, that..."},
				{"speaker": "りきぞう", "jp": "あれ？",                         "en": "That?"},
				{"speaker": "yuki",   "jp": "白いです...こわいです...",       "en": "It's white... it's scary..."},
				{"speaker": "りきぞう", "jp": "！ゆきさん、ぼくも見ます！",   "en": "! Yuki, I see it too!"},
				{"speaker": "yuki",   "jp": "ほんとう？",                     "en": "Really?"},
				{"speaker": "りきぞう", "jp": "ふたりだけですね...",           "en": "Just the two of us..."},
				{"speaker": "yuki",   "jp": "...わかりません...",             "en": "...I don't know..."},
			]
		GameManager.start_conversation(yuki_lines, yuki_opts)
		return

	# Yuki — repeatable talk after the first meeting. The void is the only
	# thing either of them can focus on now; a short shared-dread beat so
	# re-approaching her always fires something (previously dead after the
	# one-time first-meeting branch consumed met_yuki).
	if npc.npc_name == "yuki" and GameManager.met_yuki:
		var yuki_again_shocked: Texture2D = GameManager.alt_portraits.get("meShocked")
		var yuki_again_opts := {"background": "void"}
		if yuki_again_shocked:
			yuki_again_opts["portrait_overrides"] = {"りきぞう": yuki_again_shocked}
		GameManager.start_conversation([
			{"speaker": "yuki",   "jp": "りきぞうくん...",             "en": "Rikizo..."},
			{"speaker": "りきぞう", "jp": "ゆきさん。あれ、まだありますね。", "en": "Yuki-san. That's still there."},
			{"speaker": "yuki",   "jp": "はい...白いです...",         "en": "Yes... it's white..."},
			{"speaker": "yuki",   "jp": "こわいです...",             "en": "I'm scared..."},
			{"speaker": "りきぞう", "jp": "ふたりだけですね...",         "en": "Just the two of us..."},
		], yuki_again_opts)
		return

	# Post-void one-time conversations
	if GameManager.void_seen and not GameManager.void_asked.has(npc.npc_name):
		GameManager.void_asked[npc.npc_name] = true
		var shocked: Texture2D = GameManager.alt_portraits.get("meShocked")

		if npc.npc_name == "mom":
			convo = [
				{"speaker": "りきぞう", "jp": "お母さん…！", "en": "Mom…!"},
				{"speaker": "りきぞう", "jp": "そとに…なにも…！", "en": "Outside… nothing…!"},
				{"speaker": "mom", "jp": "なに？", "en": "What?"},
				{"speaker": "mom", "jp": "パソコンはありますよ。", "en": "You have your persocon, you know."},
				{"speaker": "mom", "jp": "いい先生ですよ。パソコンでべんきょうしてね。", "en": "You're a good teacher. Go study on your persocon, OK?"},
				{"speaker": "りきぞう", "jp": "…はい。", "en": "…OK."}
			]
			if shocked:
				options["portrait_overrides"] = {"りきぞう": shocked}

		elif npc.npc_name == "dad":
			convo = [
				{"speaker": "りきぞう", "jp": "お父さん！", "en": "Dad!"},
				{"speaker": "りきぞう", "jp": "そとに…なにもない…！", "en": "Outside… there's nothing…!"},
				{"speaker": "dad", "jp": "ん？そとですか。", "en": "Hm? Outside?"},
				{"speaker": "dad", "jp": "パソコンはいいですか？", "en": "Is your persocon working OK?"},
				{"speaker": "りきぞう", "jp": "え…？パソコン…？", "en": "Huh…? The persocon…?"},
				{"speaker": "dad", "jp": "先生ですよ。パソコンでがんばってね。", "en": "You're a teacher. Do your best on the persocon, OK?"},
				{"speaker": "りきぞう", "jp": "…はい。", "en": "…OK."}
			]
			if shocked:
				options["portrait_overrides"] = {"りきぞう": shocked}

		GameManager._save()

	GameManager.start_conversation(convo, options)


func _handle_object_interaction(obj) -> void:
	# Capture "is this the very first examine of this object" BEFORE the
	# inspected[name] flag flips — useful for first-time-only reactions.
	var first_examine: bool = not GameManager.inspected.has(obj.object_name)
	GameManager.inspected[obj.object_name] = true
	# Refresh the label so the next approach shows the name instead of "???"
	obj._update_label()

	if obj.is_door:
		_handle_door(obj)
	elif obj.object_name == "Laptop":
		_handle_laptop()
	elif obj.object_name == "Clock":
		# Day 4: N5.4 teaches 時 and 分 — the clock becomes readable. Before
		# that, Rikizo recognizes the digit but can't name the counter.
		if GameManager.current_day >= 4:
			GameManager.show_message({
				"jp": "今、9時0分です。",
				"en": "It's 9:00 now.",
			})
		else:
			GameManager.show_message({
				"jp": "9... ＿＿？",
				"en": "Nine... what?",
			})
	elif obj.object_name == "Calendar":
		# Day 2+: open the calendar overlay with the weekday picker (per N5.2 spec).
		# Day 1: just a popup with the day count, since weekday vocab isn't taught yet.
		if GameManager.current_day >= 2 and calendar_overlay:
			calendar_overlay.open_calendar()
		else:
			GameManager.show_message({
				"jp": "Day %d です。" % GameManager.current_day,
				"en": "Day %d." % GameManager.current_day,
			})
	elif obj.object_name == "TV":
		# Day 10: 電気 toggle — the TV gains an on/off state (weather broadcast
		# on-screen). Before Day 10 it stays an inert examine.
		if GameManager.current_day >= 10:
			GameManager.tv_on = not GameManager.tv_on
			if obj.obj_sprite:
				var tvp := "res://assets/days/day-01-home/objects/tv_on.png" if GameManager.tv_on else "res://assets/days/day-01-home/objects/tv.png"
				obj.obj_sprite.texture = load(tvp) as Texture2D
			if GameManager.tv_on:
				GameManager.tv_turned_on = true
				GameManager.show_message({"jp": "テレビをつけました。今日の天気は…いい天気です。", "en": "Turned on the TV. Today's weather is… nice."})
			else:
				GameManager.show_message({"jp": "電気をけしました。", "en": "Turned it off."})
			GameManager._save()
		else:
			GameManager.show_message({"jp": "テレビです。", "en": "The TV."})
	elif obj.object_name == "Lamp":
		# Day 10: 電気 toggle — desk lamp on/off (object appears Day 10+, so
		# this only runs once 電気 is a concept).
		GameManager.lamp_on = not GameManager.lamp_on
		if obj.obj_sprite:
			var lp := "res://assets/days/day-01-home/objects/lamp_on.png" if GameManager.lamp_on else "res://assets/days/day-01-home/objects/lamp.png"
			obj.obj_sprite.texture = load(lp) as Texture2D
		GameManager.lamp_toggled = true
		if GameManager.lamp_on:
			GameManager.show_message({"jp": "電気をつけました。", "en": "Turned on the light."})
		else:
			GameManager.show_message({"jp": "電気をけしました。", "en": "Turned off the light."})
		GameManager._save()
	elif obj.object_name == "Telescope":
		# Day 6+ overlook viewpoint on day-06-street-east. Opens the
		# mountain-river convo bg with Rikizo's observation. The river
		# is visible in the SE corner but disconnected from the mountain
		# by a band of void fog — Yamakawa's "water comes from the
		# mountains" claim rendered physically impossible.
		if first_examine:
			# First beat is a portrait-less "..." over the scenic bg so the
			# player takes in the view before Rikizo pops in to comment.
			GameManager.start_conversation([
				{"speaker": "", "jp": "...",                                 "en": "..."},
				{"speaker": "りきぞう", "jp": "山です。",                       "en": "A mountain."},
				{"speaker": "りきぞう", "jp": "...山さんですか？",              "en": "...Mr. Mountain?"},
				{"speaker": "りきぞう", "jp": "あ、川も。山さんの川ですか？",   "en": "Oh, a river too. Is it Mr. Mountain's river?"},
				{"speaker": "りきぞう", "jp": "...",                            "en": "..."},
			], {"background": "mountain-river"})
			GameManager.paranoia(1)
		else:
			GameManager.start_conversation([
				{"speaker": "", "jp": "...",                       "en": "..."},
				_rotating_line("telescope_view", [
					{"speaker": "りきぞう", "jp": "山さん、こんにちは。",         "en": "Hello, Mr. Mountain."},
					{"speaker": "りきぞう", "jp": "川は…まだ とおいです。",       "en": "The river is... still far."},
					{"speaker": "りきぞう", "jp": "山と川の あいだ、白いです。",   "en": "Between the mountain and the river, it's white."},
					{"speaker": "りきぞう", "jp": "山さんは しずかですね。",       "en": "Mr. Mountain is quiet, isn't he."},
					{"speaker": "りきぞう", "jp": "きれいですが…さびしいです。",   "en": "It's pretty, but... lonely."},
				]),
			], {"background": "mountain-river"})
	elif obj.object_name == "Vending_Machine":
		# Day 6-7: display-only — Rikizo notices the machine but 買う
		# isn't taught yet so the menu opens in window-shopping mode.
		# Day 8+: the same menu becomes buyable. Checkout fires the
		# tap-to-pay cinematic (no shopkeeper "please tap" line — the
		# machine just hums + clunks), then deducts yen + stacks items
		# into inventory, then a brief ガコン! popup for the drop.
		var vending_items := _vending_shop_items()
		if GameManager.current_day >= 8:
			shop_menu_overlay.on_checkout = func(cart: Dictionary):
				_process_vending_purchase(cart, vending_items)
		var on_end: Callable = func():
			shop_menu_overlay.open_menu(vending_items)
		GameManager.start_conversation([
			{"speaker": "りきぞう", "jp": "じはんきです。", "en": "A vending machine."},
		], {"background": "street", "on_end": on_end})
	elif obj.object_name == "Bus_Stop":
		# Day 5+ residential street. First examine: Rikizo wonders about
		# the bus — when it comes, where it goes. Street convo bg.
		if first_examine:
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "バス停です。",                "en": "A bus stop."},
				{"speaker": "りきぞう", "jp": "バスは...いつ来ますか？",     "en": "When does the bus come?"},
				{"speaker": "りきぞう", "jp": "どこに行きますか？",          "en": "Where does it go?"},
				{"speaker": "りきぞう", "jp": "...バスは、ないですね。",     "en": "...There's no bus."},
			], {"background": "street"})
		else:
			GameManager.show_message({"jp": "バス停です。", "en": "A bus stop."})
	elif obj.object_name == "Fence":
		# Day 5: the residential street's north edge. Beyond the fence the
		# world simply hasn't been made yet — Rikizo peers over and finds the
		# white nothing. First examine = the small dread beat; repeats shrug.
		if first_examine:
			GameManager.paranoia(1)
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "フェンスです。", "en": "A fence."},
				{"speaker": "りきぞう", "jp": "むこうは...", "en": "Beyond it..."},
				{"speaker": "りきぞう", "jp": "...白いです。", "en": "...white."},
				{"speaker": "りきぞう", "jp": "なにも ないですね。", "en": "There's nothing there."},
			], {"background": "street"})
		else:
			GameManager.show_message({"jp": "むこうは、なにも ないです。", "en": "Beyond it, there's nothing."})
	elif obj.object_name == "Curry_Hut":
		# Riverside curry stand. Appears Day 7 (appearsFromDay), but the verbs
		# gate the experience: Day 7 the player can only NOTICE it (ほしい
		# "want" + 買う "buy" both land N5.8 / Day 8), so eating opens Day 8.
		# Yamakawa's Day-7 hint points the player here. The cook is baked into
		# the hut sprite; his convo portrait is fed via portrait_overrides.
		var cook_tex: Texture2D = load("res://assets/days/day-06-river/characters/curry_cook_convo.png") as Texture2D
		var curry_opts := {"background": "mountain-river"}
		if cook_tex:
			curry_opts["portrait_overrides"] = {"cook": cook_tex}
		if GameManager.current_day < 8:
			# Day 7: discovery only — Rikizo clocks the stand and plans to come
			# back. No ほしい / 買う / eating yet (not taught until Day 8).
			GameManager.start_conversation([
				{"speaker": "cook",   "jp": "いらっしゃい！",      "en": "Welcome!"},
				{"speaker": "りきぞう", "jp": "あ、カレーですね！",  "en": "Ah, it's curry!"},
				{"speaker": "りきぞう", "jp": "また 来ます。",        "en": "I'll come again."},
				{"speaker": "cook",   "jp": "はい、どうぞ！",      "en": "Sure, anytime!"},
			], curry_opts)
		else:
			# Day 8+: ほしい + 買う are taught. Same flow as the other shops —
			# greet → pop-up menu → tap-to-pay → curry lands in inventory, where
			# the player can later choose to 食べる it from the inventory panel.
			# The outdoor table/stool beside the stand is decoration.
			var curry_items := _curry_shop_items()
			shop_menu_overlay.on_checkout = func(cart: Dictionary):
				_process_curry_purchase(cart, curry_items)
			curry_opts["on_end"] = func():
				shop_menu_overlay.open_menu(curry_items)
			GameManager.start_conversation([
				{"speaker": "cook",   "jp": "いらっしゃい！",          "en": "Welcome!"},
				{"speaker": "cook",   "jp": "カレーは おいしいですよ！", "en": "The curry is delicious!"},
			], curry_opts)
	elif obj.object_name == "Blockade" or obj.object_name == "Blockade_East" or obj.object_name == "Blockade_South":
		# Day 5+ east end of the street. The world ends past the
		# barricade. First examine: Rikizo sees the void street and
		# clocks +1 paranoia. Repeats are flavor.
		if first_examine:
			GameManager.paranoia(1)
			var shocked: Texture2D = GameManager.alt_portraits.get("meShocked")
			var options := {"background": "street-void"}
			if shocked:
				options["portrait_overrides"] = {"りきぞう": shocked}
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "工事です。",            "en": "Construction."},
				{"speaker": "りきぞう", "jp": "...いいえ。",           "en": "...No."},
				{"speaker": "りきぞう", "jp": "外...何もないです。",   "en": "Outside... there's nothing."},
			], options)
		else:
			GameManager.show_message({"jp": "工事です。", "en": "Construction."})
	elif obj.object_name == "River":
		# Examining the river. Pre-Day-7: simple flavor. Day 7+ (when
		# 飲む lands): Rikizo briefly considers drinking the river water,
		# then decides against it — the first polite-negative use of the
		# new verb, and a tiny "new verbs create new decisions" beat.
		if GameManager.current_day >= 7:
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "川です。きれいですね。",   "en": "The river. It's pretty."},
				{"speaker": "りきぞう", "jp": "...飲みますか？",         "en": "...Drink?"},
				{"speaker": "りきぞう", "jp": "...飲みません。",          "en": "...No."},
			], {"background": "mountain-river"})
		else:
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "川です。きれいですね。", "en": "The river. It's pretty."},
			], {"background": "mountain-river"})
	elif obj.object_name == "Salad" or obj.object_name == "Bread" or obj.object_name == "Coffee":
		# Day 7+ breakfast — examining any of the three table foods plays
		# the whole meal beat (per the roadmap): Mom invites Rikizo to
		# eat, the いただきます/ごちそうさまでした ritual bookends an
		# eat-cinematic, and afterward ALL THREE foods are cleared (the
		# meal is finite). Fires once; the foods vanish so it won't repeat.
		var finish_meal := func():
			GameManager.show_message({"jp": "ごちそうさまでした！", "en": "Thanks for the meal!"})
			for food in ["Salad", "Bread", "Coffee"]:
				GameManager.picked_up[food] = true
				for c in objects_container.get_children():
					if "object_name" in c and c.object_name == food:
						c.queue_free()
			GameManager._save()
		var eat_cg := func():
			cg_overlay.play(
				"kitchen",
				"res://assets/cg/cg-rikizo-breakfast.png",
				"もぐもぐ",
				finish_meal,
				"rice", "chew"
			)
		GameManager.start_conversation([
			{"speaker": "mom",   "jp": "朝ごはんを食べてください。",          "en": "Please eat breakfast."},
			{"speaker": "りきぞう", "jp": "いただきます！",                      "en": "Itadakimasu!"},
			{"speaker": "mom",   "jp": "パンとサラダです。コーヒーもありますよ。", "en": "Bread and salad. There's coffee too."},
		], {"background": "kitchen", "on_end": eat_cg})
	elif obj.object_name == "Cake":
		# Same possessive-yell gag as Dad's gold. Mom snaps from wherever she
		# is. The (reason, npc) annoyance cap means this fires at most once
		# per day no matter how many times Rikizo pokes the cake.
		var stern_mom: Texture2D = GameManager.alt_portraits.get("momScolding")
		var options := {"background": "kitchen"}
		if stern_mom:
			options["portrait_overrides"] = {"mom": stern_mom}
		GameManager.start_conversation([
			{"speaker": "mom",   "jp": "ケーキ！だめ！",       "en": "The cake! No!"},
			{"speaker": "りきぞう", "jp": "す、すみません…！",   "en": "S-sorry…!"},
		], options)
		GameManager.annoy("mom", "cake")
	elif obj.object_name == "Dads_Car":
		# Day 6+ Dad's car gag — touching the car makes Dad text Rikizo
		# from inside the house. Phone buzzes. First touch per day adds
		# the text + bumps dad annoyance; subsequent touches just have
		# Rikizo observe the car.
		var first_touch_today: bool = not GameManager.annoyance_today.has("car_today_dad")
		if first_touch_today:
			GameManager.annoy("dad", "car_today")
			GameManager.add_message(
				"dad", "お父さん", "Dad",
				"res://assets/days/day-01-home/characters/taro_head.png",
				"dad", "だめ。", "No."
			)
			# Same notification mechanic as the new-quest signal: pop the
			# phone, shake it, red dot on Messages (add_message set unread).
			GameManager.phone_force_open.emit()
		else:
			GameManager.show_message({"jp": "車です。", "en": "A car."})
	elif obj.object_name == "Tree":
		_handle_tree()
	elif obj.object_name == "Dirt":
		_handle_dirt()
	elif obj.object_name == "Water":
		_handle_water(obj)
	elif obj.object_name == "Special_Vending":
		_handle_gachapon()
	elif obj.object_name == "Gold" and GameManager.current_day >= 2:
		# Day 2+ running gag: touching the gold makes dad yell from wherever he is.
		var angry_dad: Texture2D = GameManager.alt_portraits.get("dadAngry")
		var options := {"background": "living"}
		if angry_dad:
			options["portrait_overrides"] = {"dad": angry_dad}
		GameManager.start_conversation([
			{"speaker": "dad", "jp": "金！だめ！", "en": "The gold! No!"},
			{"speaker": "りきぞう", "jp": "す、すみません…！", "en": "S-sorry…!"}
		], options)
		GameManager.annoy("dad", "gold")
	elif obj.object_name == "Porch_Back":
		# Outside-map porch interaction → transition back to indoor map.
		# Spawn just inside (north of) Day 01's Front_Door so player appears
		# in the genkan. Day 5+: coming-home call-and-response — Rikizo calls
		# ただいま from the genkan, Mom answers おかえり from the kitchen
		# (mirror of the いってきます/いってらっしゃい send-off at Front_Door).
		var to_home := func():
			transition_to_day("day-01-home", Vector2(993, 640))
		if GameManager.current_day >= 5:
			var home_opts := {"background": "entryway", "on_end": to_home}
			var mom_portrait: Texture2D = load("res://assets/days/day-01-home/characters/sakura_convo.png") as Texture2D
			if mom_portrait:
				home_opts["portrait_overrides"] = {"mom": mom_portrait}
			GameManager.start_conversation(
				[
					{"speaker": "りきぞう", "jp": "ただいま！", "en": "I'm home!",      "background": "entryway"},
					{"speaker": "mom",    "jp": "おかえり！", "en": "Welcome back!",  "background": "kitchen"},
				],
				home_opts
			)
		else:
			to_home.call()
	elif obj.object_name == "Exit_West":
		# Walk west off street → street-west; or street-west → station;
		# or day-06-street-east → day-05-street;
		# or day-06-intersection → day-06-street-east;
		# or day-08-depaato → day-06-intersection.
		# Y preserved across the boundary; X = 1208 (just inside east edge).
		var px_w := player.global_position
		if DAY_DATA_DIR.find("day-05-street/") != -1:
			transition_to_day("day-05-street-west", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-05-street-west/") != -1:
			transition_to_day("day-05-station", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-06-street-east/") != -1:
			transition_to_day("day-05-street", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-06-intersection/") != -1:
			transition_to_day("day-06-street-east", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-08-depaato/") != -1:
			transition_to_day("day-06-intersection", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-09-river-east/") != -1:
			# Walk west off the river-east path → back to day-06-river just
			# inside its east edge. Same south concrete path band; Y
			# preserved across the seam.
			transition_to_day("day-06-river", Vector2(1208, px_w.y))
		elif DAY_DATA_DIR.find("day-10-hotel-street/") != -1:
			# West off the hotel street → back to the T-junction's east arm.
			transition_to_day("day-10-street-south", Vector2(1190, px_w.y))
	elif obj.object_name == "Exit_East":
		# Mirror of Exit_West. Y preserved; X = 40 (just inside west edge).
		var px_e := player.global_position
		if DAY_DATA_DIR.find("day-05-street-west/") != -1:
			transition_to_day("day-05-street", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-05-station/") != -1:
			transition_to_day("day-05-street-west", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-05-street/") != -1:
			transition_to_day("day-06-street-east", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-06-street-east/") != -1:
			transition_to_day("day-06-intersection", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-06-intersection/") != -1:
			transition_to_day("day-08-depaato", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-06-river/") != -1:
			# Day 9+ unlock: Yamakawa's Yuki convo flips told_about_yuki,
			# which makes the Exit_East zone appear (gated via
			# appearsWhenFlag on the day-06-river day.json). Player walks
			# east off the river path → lands on the south concrete path
			# of day-09-river-east just inside its west edge.
			transition_to_day("day-09-river-east", Vector2(40, px_e.y))
		elif DAY_DATA_DIR.find("day-10-street-south/") != -1:
			# East arm of the T-junction → the hotel street (next chunk).
			if ResourceLoader.exists("res://assets/days/day-10-hotel-street/day.json"):
				transition_to_day("day-10-hotel-street", Vector2(40, px_e.y))
			else:
				GameManager.show_message({"jp": "...こうじ中です。", "en": "...Under construction."})
	elif obj.object_name == "Path_North":
		# Walk north off street-west via the konbini driveway → konbini lot.
		# X preserved; player lands just inside konbini's south sidewalk.
		# Day 9+: the konbini exterior is the no-window + gachapon version
		# (day-09-konbini-gacha); days 5-8 use the original windowed one.
		if DAY_DATA_DIR.find("day-05-street-west/") != -1:
			var konbini_ext := "day-09-konbini-gacha" if GameManager.current_day >= 9 else "day-05-konbini"
			transition_to_day(konbini_ext, Vector2(player.global_position.x, 700))
	elif obj.object_name == "Exit_North":
		# Walk north off day-06-intersection → day-06-river.
		# X preserved; lands at the south edge of the river chunk just
		# inside the road's bottom.
		if DAY_DATA_DIR.find("day-06-intersection/") != -1:
			transition_to_day("day-06-river", Vector2(player.global_position.x, 792))
		elif DAY_DATA_DIR.find("day-10-street-south/") != -1:
			# North off the T-junction connector → back up to the intersection.
			transition_to_day("day-06-intersection", Vector2(player.global_position.x, 760))
	elif obj.object_name == "Exit_South":
		# Walk south off the konbini lot back through the driveway →
		# land back on street-west's north sidewalk. X preserved.
		# Walk south off day-06-river → day-06-intersection (X preserved).
		# Walk south off the konbini INTERIOR through the sliding doors
		# → land back on the exterior konbini chunk just south of the
		# door (so the player faces away from the doors).
		if DAY_DATA_DIR.find("day-05-konbini/") != -1:
			transition_to_day("day-05-street-west", Vector2(player.global_position.x, 234))
		elif DAY_DATA_DIR.find("day-09-konbini-gacha/") != -1:
			# Day-9 konbini exterior — same south exit back to street-west.
			transition_to_day("day-05-street-west", Vector2(player.global_position.x, 234))
		elif DAY_DATA_DIR.find("day-06-river/") != -1:
			transition_to_day("day-06-intersection", Vector2(player.global_position.x, 40))
		elif DAY_DATA_DIR.find("day-06-intersection/") != -1:
			# Day 10: south off the intersection (Blockade_South gone) → the
			# T-junction street.
			transition_to_day("day-10-street-south", Vector2(player.global_position.x, 60))
		elif DAY_DATA_DIR.find("day-09-konbini-inside/") != -1:
			# Interior only exists day 9+, when the exterior is the gacha version.
			transition_to_day("day-09-konbini-gacha", Vector2(760, 260))
		elif DAY_DATA_DIR.find("day-09-station-inside/") != -1:
			# Walk south out of the station interior through the sliding
			# doors → land back on day-05-station just outside. Adjust
			# spawn position via positioner once Door_Inside lands.
			transition_to_day("day-05-station", Vector2(700, 280))
		elif DAY_DATA_DIR.find("day-09-depaato-inside/") != -1:
			# Walk south through the depaato sliding doors → land back on
			# day-08-depaato just outside the storefront. Adjust spawn
			# position via positioner once Door_Inside on the exterior
			# is finalized.
			transition_to_day("day-08-depaato", Vector2(624, 280))
		elif DAY_DATA_DIR.find("day-10-hotel-inside/") != -1:
			# Out the lobby glass doors → back onto the hotel street just
			# south of the entrance/porte-cochère (now at x≈830 in the rebuilt
			# exterior, with the hotel filling the NE 2/3).
			transition_to_day("day-10-hotel-street", Vector2(832, 470))
	elif obj.object_name == "Exit_Platform":
		# Day 10: the waiting-room west passage (barricade gone) opens onto
		# the platform behind the station.
		transition_to_day("day-10-platform", Vector2(200, 540))
	elif obj.object_name == "Exit_Door":
		# Platform west doorway → back into the station waiting room. Spawn on
		# the open concourse floor SOUTH of the turnstiles — the old (240,500)
		# landed the player wedged inside the turnstile collision band
		# (verified red at y≈500, x160–320 in the collision mask).
		transition_to_day("day-09-station-inside", Vector2(200, 560))
	elif obj.object_name == "Train":
		# Parked train. Rikizo admires it; the doors give no response — 乗る
		# (to board) is N4, so there is no interaction beyond looking.
		if first_examine:
			GameManager.show_message({"jp": "電車です！大きいですね。", "en": "A train! It's big."})
		else:
			GameManager.show_message({"jp": "...", "en": "..."})
	elif obj.object_name == "Timetable":
		# The board shows only the word 電車 — no schedule, no destination.
		GameManager.show_message({"jp": "「電車」。いつ きますか？", "en": "\"Train.\" When does it come?"})

	elif obj.object_name == "Hotel_Entrance":
		# The hotel lobby is the next interior chunk. Guard until it exists.
		if ResourceLoader.exists("res://assets/days/day-10-hotel-inside/day.json"):
			transition_to_day("day-10-hotel-inside", Vector2(624, 700))
		else:
			GameManager.show_message({"jp": "ホテルです。", "en": "A hotel."})
	elif obj.object_name == "Door_Inside":
		# Walk into the konbini through the front sliding doors (Day 9+
		# only; gated by appearsFromDay: 9 on the source object). Lands
		# the player just inside the south-wall doorway gap in the
		# interior chunk, facing into the store.
		if DAY_DATA_DIR.find("day-05-konbini/") != -1:
			transition_to_day("day-09-konbini-inside", Vector2(620, 730))
		elif DAY_DATA_DIR.find("day-09-konbini-gacha/") != -1:
			# Day-9 konbini exterior → same interior, same spawn.
			transition_to_day("day-09-konbini-inside", Vector2(620, 730))
		elif DAY_DATA_DIR.find("day-05-station/") != -1:
			# Walk into the station building (Day 9+; gated by
			# appearsFromDay: 9 on the day-05-station Door_Inside).
			# Lands the player just inside the south doorway gap.
			transition_to_day("day-09-station-inside", Vector2(624, 590))
		elif DAY_DATA_DIR.find("day-08-depaato/") != -1:
			# Walk into the depaato through the storefront sliding
			# doors (Day 9+; gated by appearsFromDay: 9 on the day-08
			# Door_Inside zone). Lands the player just inside the south
			# entrance gap on the marble floor.
			transition_to_day("day-09-depaato-inside", Vector2(624, 620))
	elif obj.object_name == "Toilet" and GameManager.is_door_open("Bath_Door"):
		# Dad yells if you use the toilet with the door open
		var angry_dad: Texture2D = GameManager.alt_portraits.get("dadAngry")
		var options := {"background": "living"}
		if angry_dad:
			options["portrait_overrides"] = {"dad": angry_dad}
		GameManager.start_conversation([
			{"speaker": "dad", "jp": "おい！ドアをしめて！", "en": "Hey! Close the door!"},
			{"speaker": "りきぞう", "jp": "す、すみません…！", "en": "S-sorry…!"}
		], options)
		GameManager.annoy("dad", "toilet_open")
	elif not obj.message_data.is_empty():
		GameManager.show_message(obj.message_data)


func _handle_depaato_worker(options: Dictionary) -> void:
	## Depaato 1F counter worker. Sells one generic present for ¥10,000,
	## fulfilling the shopping_present quest (Mom asks for a present for
	## Dad on Day 8). present uses the present_stack sprite as its
	## inventory icon.
	const PRICE := 10000
	const PRESENT := {
		"id": "present",
		"nameJp": "プレゼント",
		"nameEn": "Present",
		"sprite": "res://assets/days/day-09-depaato-inside/objects/present_stack.png",
		"description": "[i]A wrapped present for Dad.[/i]",
	}

	# Already bought: polite thank-you, no second sale.
	if GameManager.has_item("present"):
		GameManager.start_conversation([
			{"speaker": "depaato_worker", "jp": "ありがとうございました！", "en": "Thank you very much!"},
		], options)
		return

	# Insufficient funds: she names the price.
	if GameManager.yen < PRICE:
		GameManager.start_conversation([
			{"speaker": "depaato_worker", "jp": "プレゼントは一万円です。",       "en": "The present is ¥10,000."},
			{"speaker": "depaato_worker", "jp": "お金が たりませんね...",          "en": "You don't have enough money..."},
		], options)
		return

	var do_purchase := func():
		var finish := func():
			GameManager.spend_yen(PRICE, "デパート")
			GameManager.add_item(PRESENT)
			GameManager.complete_quest("shopping_present")
			GameManager.show_message({
				"jp": "プレゼントを 買いました！",
				"en": "Bought the present!",
			})
		if tap_to_pay:
			tap_to_pay.play(PRICE, "konbini-inside", finish)
		else:
			finish.call()

	# Greeting + offer, then the buy/no choice. on_end arms the choice so
	# it pops right after her line.
	options["on_end"] = func():
		if choice_overlay:
			choice_overlay.ask(
				{
					"jp": "プレゼントを 一万円で 買いますか？",
					"en": "Buy the present for ¥10,000?",
				},
				do_purchase
			)
		else:
			do_purchase.call()
	GameManager.start_conversation([
		{"speaker": "depaato_worker", "jp": "いらっしゃいませ！",               "en": "Welcome!"},
		{"speaker": "depaato_worker", "jp": "プレゼントは いかがですか？",       "en": "How about a present?"},
		{"speaker": "depaato_worker", "jp": "一万円です。",                       "en": "It's ¥10,000."},
	], options)


func _handle_gachapon() -> void:
	## Special_Vending machine (day-09-konbini-gacha) — sells phone cases.
	## Opens the shop purchase screen showing the available case + its
	## price; checkout fires the tap-to-pay cinematic, then grants the
	## case. Currently dispenses red_promo for ¥1,000; future story beats
	## rotate the displayed item.
	const CASE_ID := "red_promo"
	const ITEM_ID := "red_promo_case"
	const PRICE := 1000

	# Already owned: short flavor line, machine has nothing else for now.
	if GameManager.owned_phone_cases.has(CASE_ID):
		GameManager.show_message({
			"jp": "もう 買いました。",
			"en": "Already bought this one.",
		})
		return

	if shop_menu_overlay == null:
		# Defensive fallback if the overlay isn't present this scene.
		if GameManager.spend_yen(PRICE, "ガチャ"):
			GameManager.add_phone_case(CASE_ID)
			GameManager.show_message({"jp": "あかいケースを もらいました！", "en": "Got the red phone case!"})
		return

	# Purchase screen: one item card (the case), capped to a single unit.
	var item := {
		"id": ITEM_ID,
		"jp": "あかいケース",
		"en": "Red Phone Case",
		"price": PRICE,
		"sprite": "res://assets/phone_cases/red_promo/sumaho_large.png",
		"max": 1,
	}
	shop_menu_overlay.on_checkout = func(cart: Dictionary):
		if int(cart.get(ITEM_ID, 0)) < 1:
			return  # nothing selected
		shop_menu_overlay.close_menu()
		if GameManager.yen < PRICE:
			GameManager.show_message({"jp": "お金が たりません。", "en": "Not enough yen."})
			return
		var grant := func():
			GameManager.spend_yen(PRICE, "ガチャ")
			GameManager.add_phone_case(CASE_ID)
			GameManager.show_message({"jp": "あかいケースを もらいました！", "en": "Got the red phone case!"})
		if tap_to_pay:
			tap_to_pay.play(PRICE, "konbini-outside", grant)
		else:
			grant.call()
	shop_menu_overlay.open_menu([item])


func _handle_water(obj) -> void:
	## First Water examine on Day 2+ = pickup. Adds to inventory, creates the
	## 水を___ quest (verb-blank until Day 7), shows a brief tutorial
	## conversation explaining inventory + quest log + the I/Q hotkeys.
	## Subsequent examines (after pickup) just say "みずです。"

	if GameManager.has_item("water_bottle"):
		# Already in inventory — short flavor line.
		GameManager.show_message({"jp": "もう もっています。", "en": "I've already got it."})
		return

	# Mark this physical sprite as picked up (filters it out on future
	# day loads) AND remove the node now so it vanishes from the kitchen
	# immediately on pickup.
	GameManager.picked_up[obj.object_name] = true
	obj.queue_free()

	GameManager.add_item({
		"id": "water_bottle",
		"nameJp": "みず",
		"nameEn": "Water",
		"sprite": "res://assets/days/day-01-home/objects/water.png",
		"description": "[i]A bottle of mineral water.[/i]\n[i]A bottle, but you can't open it. Or can you?[/i]",
	})

	GameManager.add_quest({
		"id": "drink_water",
		"jp": "水を%s",
		"en": "%s the water",
		"verb": null,
		"verb_en": null,
	})

	var tutorial_convo := [
		{"speaker": "りきぞう", "jp": "水です。", "en": "Water."},
		{"speaker": "りきぞう", "jp": "クエスト：水を＿＿", "en": "Quest: ＿＿ the water"},
		{"speaker": "りきぞう", "jp": "「＿＿」は何ですか？", "en": "What does '＿＿' mean?"},
	]
	GameManager.start_conversation(tutorial_convo, {"background": "kitchen"})


func _handle_tree() -> void:
	## Tree-san unlock has a strict window: Days 2-4 only.
	## - If already unlocked: tree-san is an NPC; bump relationship and
	##   fire a day-specific line (different content unlocks per day).
	## - Day 1: tree is just a tree.
	## - Days 2-4 + not unlocked: count toward unlock. On 3rd examine in
	##   that window, unlock (sets tree_san_unlocked, names it 木さん,
	##   counts as the first day's relationship +1).
	## - Day 5+ and not unlocked: tree stays a tree, no progress.
	var day := GameManager.current_day

	if GameManager.tree_san_unlocked:
		# Tree is now an NPC — relationship +1 (capped 1/day) and day-specific dialogue.
		GameManager.bump_relationship("Tree")
		_tree_convo(_tree_san_lines_for_day(day))
		return

	if day == 1:
		_tree_convo([{"speaker": "りきぞう", "jp": "木です。いい木ですね。", "en": "A tree. Nice tree."}])
		return

	if day >= 2 and day <= 4:
		GameManager.tree_count += 1
		match GameManager.tree_count:
			1:
				_tree_convo([{"speaker": "りきぞう", "jp": "木です。いい木ですね。", "en": "A tree. Nice tree."}])
			2:
				_tree_convo([{"speaker": "りきぞう", "jp": "木...名は何ですか？", "en": "Tree... what's your name?"}])
			3:
				# Unlock!
				GameManager.tree_san_unlocked = true
				GameManager.bump_relationship("Tree")
				GameManager._save()
				_tree_convo([{"speaker": "りきぞう", "jp": "今日から友だちです。木さん。", "en": "From today, we're friends. Mr. Tree."}])
			_:
				_tree_convo([{"speaker": "りきぞう", "jp": "木さん？", "en": "Mr. Tree?"}])
		return

	# Day 5+ and never unlocked — too late. Just a tree.
	_tree_convo([{"speaker": "りきぞう", "jp": "木です。", "en": "A tree."}])


func _tree_san_lines_for_day(day: int) -> Array:
	## Day-specific things Rikizo tells Mr. Tree about. Placeholder content
	## for Days 5+ until later-day scripts are written.
	match day:
		2:
			return [{"speaker": "りきぞう", "jp": "木さん、こんにちは。", "en": "Hi, Mr. Tree."}]
		3:
			return [
				{"speaker": "りきぞう", "jp": "木さん、今日もいい日ですね。", "en": "Mr. Tree, today's a good day too."},
				{"speaker": "りきぞう", "jp": "お母さんは「木は人ではない」と言いました。", "en": "Mom said 'a tree isn't a person.'"},
			]
		4:
			return [
				{"speaker": "りきぞう", "jp": "木さん、お元気ですか？", "en": "Mr. Tree, how are you?"},
			]
		5:
			# Day 5: world opened up. Rikizo tells Tree-san he's heading
			# out today too. Tree, naturally, is not going anywhere.
			return [
				{"speaker": "りきぞう", "jp": "木さん、今日も行きますよ。", "en": "Mr. Tree, I'm heading out today too."},
			]
		6:
			# Day 6: mountains materialized overnight. Rikizo reports
			# the geological event to Tree-san. Tree, naturally, has
			# always been here and has no comment.
			return [
				{"speaker": "りきぞう", "jp": "木さん、今日は山がありますよ。", "en": "Mr. Tree, there are mountains today."},
				{"speaker": "りきぞう", "jp": "...木さんも、山が好きですか？",   "en": "...Do you like mountains too, Mr. Tree?"},
			]
		7:
			# Day 7: eating exists now. Rikizo announces breakfast,
			# checks whether trees eat (they don't), and — if Mom blamed
			# Tree for the cake — quietly vindicates him.
			var lines := [
				{"speaker": "りきぞう", "jp": "木さん、今日からご飯を食べます。", "en": "Mr. Tree, starting today I eat meals."},
				{"speaker": "りきぞう", "jp": "木さんも食べますか？",             "en": "Do you eat too, Mr. Tree?"},
			]
			if GameManager.mom_cake_done and GameManager.mom_cake_asked:
				# Mom blamed the tree and then confessed — Rikizo absolves him.
				lines.append({
					"speaker": "りきぞう", "jp": "あ、ケーキは木さんじゃないですよ。お母さんでした。",
					"en": "Oh, the cake wasn't you, Mr. Tree. It was Mom."
				})
			return lines
		8:
			# Day 8: today's adjectives land. The eternal tree finally gets
			# 古い applied (per the roadmap — Tree-san joins 大きい + 大すき
			# with a third adjective). Rikizo uses today's other new word,
			# ほしい, to ask what Tree-san wants — and answers for him,
			# because trees can't shop but they can want water.
			return [
				{"speaker": "りきぞう", "jp": "木さん、古い木ですね。",        "en": "Mr. Tree, you're an old tree, aren't you."},
				{"speaker": "りきぞう", "jp": "木さんは何がほしいですか？",     "en": "What do you want, Mr. Tree?"},
				{"speaker": "りきぞう", "jp": "...水ですね。",                  "en": "...water, huh."},
			]
		9:
			# Day 9: gated on whether Rikizo has met Yuki yet. AFTER meeting
			# her, he tells Tree-san the big news — he's not the only one who
			# sees the void anymore. BEFORE, the usual "trees don't travel"
			# gag while he heads out to the depaato.
			if GameManager.met_yuki:
				return [
					{"speaker": "りきぞう", "jp": "木さん、ゆきさんと話しました。",   "en": "Mr. Tree, I talked with Yuki-san."},
					{"speaker": "りきぞう", "jp": "ゆきさんも、あの白いのを見ます。", "en": "Yuki-san sees that white thing too."},
					{"speaker": "りきぞう", "jp": "ぼくだけじゃないです。",           "en": "It's not just me."},
					{"speaker": "りきぞう", "jp": "...木さん、よかったです。",         "en": "...That's good, Mr. Tree."},
				]
			return [
				{"speaker": "りきぞう", "jp": "木さん、今日はデパートに行きます。", "en": "Mr. Tree, today I'm going to the depaato."},
				{"speaker": "りきぞう", "jp": "木さんも行きますか？",               "en": "Are you going too, Mr. Tree?"},
				{"speaker": "りきぞう", "jp": "...行きませんね。",                  "en": "...You're not going, huh."},
			]
		10:
			# Day 10: casual register (G9). Rikizo greets the tree like a friend
			# with 天気 small talk. If befriended, he wonders aloud when the 休み
			# (vacation) ends — the first time he questions the holiday's limit.
			var t10 := [
				{"speaker": "りきぞう", "jp": "木さん、おはよう。今日もいい天気だね。", "en": "Mr. Tree, morning. Nice weather again today."},
			]
			if GameManager.tree_san_unlocked:
				t10.append({"speaker": "りきぞう", "jp": "木さん...休みはいつまでですか？", "en": "Mr. Tree... how long is the holiday?"})
			return t10
		_:
			return [{"speaker": "りきぞう", "jp": "木さん、こんにちは。", "en": "Hi, Mr. Tree."}]


func _tree_convo(rikizo_lines: Array) -> void:
	var options := {"background": "outside"}
	var tree_portrait_path := DAY_DATA_DIR + "characters/tree_convo.png"
	if ResourceLoader.exists(tree_portrait_path):
		var tex := load(tree_portrait_path) as Texture2D
		options["portrait_overrides"] = {"tree": tex}
	var convo := []
	for line in rikizo_lines:
		convo.append(line)
		convo.append({"speaker": "tree", "jp": "...", "en": "..."})
	GameManager.start_conversation(convo, options)


func _handle_dirt() -> void:
	GameManager.dirt_count += 1
	if GameManager.dirt_count == 1:
		GameManager.show_message({"jp": "土です。", "en": "Earth."})
	else:
		GameManager.show_message({"jp": "土は土ですね。", "en": "Dirt is dirt."})


func _fade_to_black(on_black: Callable) -> void:
	## Fade the whole screen to black, run on_black at peak darkness, then fade
	## back in. A soft transition used for the laptop lesson "montage" (the
	## lesson passes in the dark). Same black-ColorRect approach as the intro.
	var layer := CanvasLayer.new()
	layer.layer = 20  # above every other overlay
	var rect := ColorRect.new()
	rect.color = Color(0, 0, 0, 0)
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_STOP  # swallow taps mid-transition
	layer.add_child(rect)
	add_child(layer)
	var tw := create_tween()
	tw.tween_property(rect, "color:a", 1.0, 0.45)
	tw.tween_interval(0.12)
	tw.tween_callback(on_black)   # set up the next beat while fully black
	tw.tween_interval(0.45)
	tw.tween_property(rect, "color:a", 0.0, 0.45)
	tw.tween_callback(layer.queue_free)


func _handle_laptop() -> void:
	## Laptop interaction: ask the player Yes/No before advancing the day.
	## Yes → 3-line lesson conversation + advance_day on close.
	## No  → just close, no advancement.
	var prev_day := GameManager.current_day

	# Recap line for the "done" beat — closing out a day means Rikizo just
	# taught the lesson that UNLOCKS the next day, so recap the NEXT day's
	# kanji. Starts from closing Day 2 (Day 1's close is the plain outro).
	var unlock_day := prev_day + 1
	var recap_line := {}
	if prev_day >= 2 and KANJI_BY_DAY.has(unlock_day):
		recap_line = {
			"speaker": "りきぞう",
			"jp": "今日のレッスンは「%s」でした。" % KANJI_BY_DAY[unlock_day],
			"en": "Today's lesson was: %s" % KANJI_BY_DAY[unlock_day],
		}
	else:
		recap_line = {
			"speaker": "りきぞう",
			"jp": "Day %d の おわり。" % prev_day,
			"en": "End of Day %d." % prev_day,
		}

	# The "done" beat (shown AFTER the fade-to-black) advances the day on close.
	var done_on_end := func():
		GameManager.advance_day()
		var begin_msg := {
			"jp": "Day %d が はじまった！" % GameManager.current_day,
			"en": "Day %d has begun!" % GameManager.current_day,
		}
		# Day 4+ auto-deposits the teaching wage in advance_day — surface that
		# in the day-begin popup so the player connects the lesson they just
		# completed to the new balance. Only mention the PHONE if Rikizo
		# actually has it (Day 4 morning the phone isn't handed over yet).
		if GameManager.current_day >= 4:
			if GameManager.has_phone:
				begin_msg["jp"] += "\nスマホに ¥%d が入りました。" % GameManager.DAILY_TEACHING_WAGE
				begin_msg["en"] += "\n¥%d deposited to the phone." % GameManager.DAILY_TEACHING_WAGE
			else:
				begin_msg["jp"] += "\n¥%d が入りました。" % GameManager.DAILY_TEACHING_WAGE
				begin_msg["en"] += "\n¥%d came in." % GameManager.DAILY_TEACHING_WAGE
		GameManager.show_message(begin_msg)

	# The "done" beat (shown after the fade) — kept as a plain var so no
	# multi-line lambda is inlined inside a dict literal (GDScript chokes on
	# that). Mirrors the eat-CG pattern used elsewhere.
	var show_done := func():
		GameManager.start_conversation(
			[{"speaker": "りきぞう", "jp": "…おわった！", "en": "...done!"}, recap_line],
			{"background": "bedroom", "on_end": done_on_end}
		)
	var after_intro := func():
		_fade_to_black(show_done)

	var do_lesson := func():
		# 1. "Time for a lesson." → 2. fade to black (the lesson passes) →
		# 3. "...done!" + recap fade back in → advance the day on close.
		GameManager.start_conversation(
			[{"speaker": "りきぞう", "jp": "レッスンをします。", "en": "Time for a lesson."}],
			{"background": "bedroom", "on_end": after_intro}
		)

	if choice_overlay:
		choice_overlay.ask(
			{"jp": "レッスンをしますか？", "en": "Do a lesson? (Advances the day)"},
			do_lesson
		)
	else:
		# Fallback if overlay missing — just run the lesson
		do_lesson.call()


func _handle_door(obj) -> void:
	# Day 2 Gate: first interaction reveals the void at the yard's edge.
	# Gate stays closed/disabled after — there's nothing past it yet.
	# Gate is the Day-2-only void trigger. Day 1 the gate is unreachable;
	# Day 2 first visit fires the void scene; Day 2 subsequent visits and
	# Day 3+ are silent (no interaction response at all).
	if obj.object_name == "Driveway_Gate":
		# Decorative for now — the carport's driveway exits onto the street
		# but Rikizo doesn't drive. Locked.
		GameManager.show_message({
			"jp": "車のもんです。",
			"en": "The car gate.",
		})
		return

	if obj.object_name == "Gate":
		# Day 5+: the world has opened up. The gate is now the transition
		# point between the yard and the residential street chunk.
		#   From the yard's south Gate: go south to the street.
		#   From the street's north Gate: go back north to the yard.
		if GameManager.current_day >= 5:
			# If we're currently in the street chunk, the Gate sends us back
			# to the yard. Otherwise (yard), it sends us out to the street.
			if DAY_DATA_DIR.find("day-05-street/") != -1:
				var back_to_yard := func():
					transition_to_day("day-02-outside", Vector2(1293, 1100))
				GameManager.start_conversation(
					[{"speaker": "りきぞう", "jp": "家に来ました。", "en": "Back home."}],
					{"background": "outside", "on_end": back_to_yard}
				)
				return
			var to_street := func():
				transition_to_day("day-05-street", Vector2(624, 208))
			GameManager.start_conversation(
				[{"speaker": "りきぞう", "jp": "外に行きます！", "en": "Heading out!"}],
				{"background": "outside", "on_end": to_street}
			)
			return
		if GameManager.current_day == 2 and not GameManager.void_seen_day2:
			# Day 2 first examine — the full void reveal + paranoia tick.
			GameManager.void_seen_day2 = true
			GameManager.paranoia(1)
			var shocked: Texture2D = GameManager.alt_portraits.get("meShocked")
			var options := {"background": "void"}
			if shocked:
				options["portrait_overrides"] = {"りきぞう": shocked}
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "白いです。何もないです。", "en": "It's white. There's nothing."}
			], options)
			return
		if GameManager.current_day >= 2 and GameManager.current_day <= 4:
			# Day 2 (repeat) / Day 3 / Day 4 — repeatable void check. The
			# world past the gate is still nothing. No paranoia farming;
			# this is the unsettling daily-routine beat until Day 5 opens
			# the world.
			var shocked2: Texture2D = GameManager.alt_portraits.get("meShocked")
			var opts2 := {"background": "void"}
			if shocked2:
				opts2["portrait_overrides"] = {"りきぞう": shocked2}
			GameManager.start_conversation([
				{"speaker": "りきぞう", "jp": "まだ白いです...", "en": "Still white..."}
			], opts2)
		return

	# Front door: behavior depends on the current day.
	# Day 1: void scene (peek outside reveals nothing). One-time.
	# Day 2-4: brief 「外です！」 line then transitions to the outside map.
	# Day 5+: proper send-off — Rikizo calls いってきます from the genkan,
	#        Mom answers いってらっしゃい from the kitchen (first cross-room
	#        conversation in the game). Then transition.
	if obj.object_name == "Front_Door" and GameManager.current_day >= 2:
		var to_outside := func():
			transition_to_day("day-02-outside", Vector2(1293, 1039))
		if GameManager.current_day >= 5:
			GameManager.start_conversation(
				[
					{"speaker": "りきぞう", "jp": "いってきます！",    "en": "I'm heading out!",       "background": "entryway"},
					{"speaker": "mom",    "jp": "いってらっしゃい！", "en": "Off you go!",            "background": "kitchen"},
				],
				{"background": "entryway", "on_end": to_outside}
			)
		else:
			GameManager.start_conversation(
				[{"speaker": "りきぞう", "jp": "外です！", "en": "Outside!"}],
				{"background": "entryway", "on_end": to_outside}
			)
		return

	if obj.object_name == "Front_Door" and not GameManager.is_door_disabled("Front_Door"):
		GameManager.disable_door("Front_Door")
		var shocked: Texture2D = GameManager.alt_portraits.get("meShocked")
		var options := {
			"background": "void",
			"on_end": func():
				GameManager.doors["Front_Door"]["open"] = false
				obj._update_door_blocker()
				obj._update_label()
				GameManager.void_seen = true
				GameManager.paranoia(1)
				GameManager._save()
		}
		if shocked:
			options["portrait_overrides"] = {"りきぞう": shocked}
		GameManager.start_conversation([
			{"speaker": "りきぞう", "jp": "え…？", "en": "Huh…?"},
			{"speaker": "りきぞう", "jp": "な…なにもない…！", "en": "Th-there's nothing there…!"},
			{"speaker": "りきぞう", "jp": "なんですか、これ…？！", "en": "What is this…?!"}
		], options)
		return

	# Disabled door — do nothing
	if GameManager.is_door_disabled(obj.object_name):
		return

	# Normal door toggle — visual state on the sprite tells the player what happened.
	var now_open := GameManager.toggle_door(obj.object_name)
	obj._update_door_blocker()
	obj._update_label()

	# Push player out if door closed on them
	if not now_open:
		_push_player_from_door(obj)


func _push_player_from_door(obj) -> void:
	var door_center: Vector2 = obj.global_position
	var px := player.global_position.x
	var py := player.global_position.y
	var half_w: float = obj.obj_width * 0.5
	var half_h: float = obj.obj_height * 0.5

	if px + 12 > door_center.x - half_w and px - 12 < door_center.x + half_w \
		and py + 10 > door_center.y - half_h and py - 20 < door_center.y + half_h:
		# Push to nearest side (above or below)
		if py < door_center.y:
			player.global_position.y = door_center.y - half_h - 21
		else:
			player.global_position.y = door_center.y + half_h + 11


func _on_message_shown(msg) -> void:
	if msg is Dictionary:
		var jp: String = str(msg.get("jp", ""))
		var en: String = str(msg.get("en", ""))
		message_label.text = jp + "\n" + en
	elif msg is String:
		message_label.text = msg
	else:
		return

	message_popup.visible = true
	await get_tree().create_timer(3.0).timeout
	message_popup.visible = false


# --- Yamakawa post-onigiri-eat live swap -----------------------------------

func _swap_yamakawa_to_no_onigiri() -> void:
	## Called from the Day 7 konbini eat-CG's on_done. Walks the npcs
	## container, finds the active Yamakawa NPC node, and swaps in the
	## no-onigiri sprite texture in-place. Also updates portrait_map so
	## subsequent dialog with Yamakawa uses the no-onigiri convo art.
	## Future chunk loads also pick up the no-onigiri art via the flag
	## check in _build_world's NPC instantiation loop.
	var no_sprite_path := "res://assets/days/day-05-konbini/characters/yamakawa_sprite.png"
	var no_convo_path  := "res://assets/days/day-05-konbini/characters/yamakawa_convo.png"
	if ResourceLoader.exists(no_sprite_path):
		var s_tex := load(no_sprite_path) as Texture2D
		for n in npcs_container.get_children():
			if "npc_name" in n and n.npc_name == "yamakawa":
				var spr := n.get_node_or_null("Sprite2D") as Sprite2D
				if spr and s_tex:
					spr.texture = s_tex
	if ResourceLoader.exists(no_convo_path):
		var c_tex := load(no_convo_path) as Texture2D
		if c_tex:
			portrait_map["yamakawa"] = c_tex
			if dialogue_overlay:
				dialogue_overlay.set_portrait_map(portrait_map)


# --- Konbini shop (Day 5-7 window-shopping + Day 8+ buying) -----------------

func _konbini_shop_items() -> Array:
	## The konbini's wares. Same list serves window-shopping (Day 5-7,
	## display-only) and buying (Day 8+, cart with checkout). Each entry
	## doubles as a menu card AND an inventory entry, so the same dict is
	## handed to GameManager.add_item on purchase. Inventory IDs match
	## what the rest of the game references (e.g. "water_bottle" stacks
	## with Rikizo's Day 2 pickup, "onigiri" feeds the eat-from-inventory
	## resolution of the おにぎりを食べる quest).
	return [
		{
			"id": "onigiri",
			"nameJp": "おにぎり", "nameEn": "Rice ball",
			"jp": "おにぎり", "en": "Rice ball",
			"price": 150,
			"sprite": "res://assets/days/day-05-konbini/objects/onigiri.png",
			"description": "[i]A rice ball wrapped in nori. From the konbini.[/i]",
		},
		{
			"id": "water_bottle",
			"nameJp": "みず", "nameEn": "Water",
			"jp": "水", "en": "Water",
			"price": 100,
			"sprite": "res://assets/days/day-01-home/objects/water.png",
			"description": "[i]A bottle of mineral water. From the konbini.[/i]",
		},
		{
			"id": "notebook",
			"nameJp": "ノート", "nameEn": "Notebook",
			"jp": "ノート", "en": "Notebook",
			"price": 300,
			"sprite": "res://assets/days/day-05-konbini/objects/notebook.png",
			"description": "[i]A blank notebook. Nothing to write yet.[/i]",
		},
	]


func _process_konbini_purchase(cart: Dictionary, items: Array) -> void:
	## Handed the cart by ShopMenuOverlay's checkout. Sequence:
	##   shopkeeper "please tap here" → tap-to-pay cinematic → spend yen
	##   + stack items into inventory → shopkeeper closing line.
	## Guard for the (shouldn't-happen) empty-cart case so we don't fire
	## the cinematic for nothing.
	var total := 0
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		total += qty * int(it.get("price", 0))
	if total <= 0:
		return
	GameManager.start_conversation([
		{"speaker": "shopkeeper", "jp": "どうぞ、こちらにタッチしてください。",
		 "en": "Here you are — please tap here."},
	], {
		"background": "konbini-inside",
		"on_end": func():
			tap_to_pay.play(total, "konbini-inside", func():
				_finalize_konbini_purchase(cart, items, total)
			)
	})


func _finalize_konbini_purchase(cart: Dictionary, items: Array, total: int) -> void:
	## Runs after the tap-to-pay cinematic finishes. Deducts the yen,
	## stacks each line item into inventory at the right quantity, then
	## plays the shopkeeper's thank-you-come-again closer.
	GameManager.spend_yen(total, "コンビニ")
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		if qty <= 0:
			continue
		GameManager.add_item(it, qty)
	GameManager.start_conversation([
		{"speaker": "shopkeeper", "jp": "ありがとうございました！また来てくださいね。",
		 "en": "Thank you very much! Please come again."},
	], {"background": "konbini-inside"})


# --- Station vending machine (Day 6-7 window-shopping + Day 8+ buying) ----

func _vending_shop_items() -> Array:
	## The station's vending machine wares. Same list serves window-
	## shopping (Day 6-7, display-only) and buying (Day 8+, cart with
	## checkout). Each entry doubles as a menu card AND an inventory
	## entry — water_bottle stacks with anything Rikizo bought at the
	## konbini or picked up Day 2; soda is a new inventory item.
	return [
		{
			"id": "water_bottle",
			"nameJp": "みず", "nameEn": "Water",
			"jp": "水", "en": "Water",
			"price": 100,
			"sprite": "res://assets/days/day-05-konbini/objects/water.png",
			"description": "[i]A bottle of mineral water. From the vending machine.[/i]",
		},
		{
			"id": "soda",
			"nameJp": "ソーダ", "nameEn": "Soda",
			"jp": "ソーダ", "en": "Soda",
			"price": 150,
			"sprite": "res://assets/days/day-06-street-east/objects/soda.png",
			"description": "[i]A cold can of soda. Fizzy.[/i]",
		},
	]


func _process_vending_purchase(cart: Dictionary, items: Array) -> void:
	## Vending-machine variant of the konbini purchase flow. NO NPC
	## "please tap" line — the machine just expects the tap. Fires the
	## tap-to-pay cinematic immediately on checkout against the station
	## street bg, then in on_done deducts yen + stacks items + plays
	## a brief ガコン! drop-popup. Guards the empty-cart case.
	var total := 0
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		total += qty * int(it.get("price", 0))
	if total <= 0:
		return
	tap_to_pay.play(total, "street", func():
		_finalize_vending_purchase(cart, items, total)
	)


func _finalize_vending_purchase(cart: Dictionary, items: Array, total: int) -> void:
	## After the tap-to-pay cinematic finishes: deduct yen, stack the
	## items, then a quick ガコン! popup as the machine drops the goods.
	GameManager.spend_yen(total, "じはんき")
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		if qty <= 0:
			continue
		GameManager.add_item(it, qty)
	GameManager.show_message({"jp": "ガコン！", "en": "Ka-chunk!"})


# --- Riverside curry stand (Day 8+ buying → eat from inventory) ----------

func _curry_shop_items() -> Array:
	## The riverside curry stand's single ware. Buyable Day 8+ (買う). The
	## entry doubles as a menu card AND the inventory item; the player eats
	## it later from the inventory panel (食べる → eat-CG).
	return [
		{
			"id": "curry",
			"nameJp": "カレー", "nameEn": "Curry",
			"jp": "カレー", "en": "Curry",
			"price": 600,
			"sprite": "res://assets/days/day-06-river/objects/curry.png",
			"description": "[i]A hot plate of curry rice from the riverside stand.[/i]",
		},
	]


func _process_curry_purchase(cart: Dictionary, items: Array) -> void:
	## Cook's "please tap" line → tap-to-pay cinematic → finalize. Mirrors
	## the konbini flow but with the curry cook + river background.
	var total := 0
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		total += qty * int(it.get("price", 0))
	if total <= 0:
		return
	var cook_tex: Texture2D = load("res://assets/days/day-06-river/characters/curry_cook_convo.png") as Texture2D
	var opts := {"background": "mountain-river"}
	if cook_tex:
		opts["portrait_overrides"] = {"cook": cook_tex}
	opts["on_end"] = func():
		tap_to_pay.play(total, "mountain-river", func():
			_finalize_curry_purchase(cart, items, total)
		)
	GameManager.start_conversation([
		{"speaker": "cook", "jp": "どうぞ、こちらにタッチしてください。",
		 "en": "Here you go — please tap here."},
	], opts)


func _finalize_curry_purchase(cart: Dictionary, items: Array, total: int) -> void:
	## After the tap-to-pay cinematic: deduct yen, stack the curry into
	## inventory, then the cook's thank-you. The player eats it later from
	## the inventory panel (食べる button).
	GameManager.spend_yen(total, "カレーや")
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		if qty <= 0:
			continue
		GameManager.add_item(it, qty)
	var cook_tex: Texture2D = load("res://assets/days/day-06-river/characters/curry_cook_convo.png") as Texture2D
	var opts := {"background": "mountain-river"}
	if cook_tex:
		opts["portrait_overrides"] = {"cook": cook_tex}
	GameManager.start_conversation([
		{"speaker": "cook", "jp": "ありがとうございました！", "en": "Thank you very much!"},
	], opts)
