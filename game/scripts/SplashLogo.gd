extends CanvasLayer
## Opening sequence for 力蔵の旅 (The Journeys of Rikizo).
##
## Phases (all on a black field):
##   1. Edison Studios animated logo (.ogv with sound), skippable after a grace.
##   2. "presents" in gold Didot, fades in/hold/out.
##   3. White flash.
##   4. The house map spins out of the void — far + fast, zooming closer and
##      slowing to rest (round and round, getting closer).
##   5. Title cards fade in over the settled map: 力蔵の旅 + The Journeys of Rikizo.
##   6. Menu: New Game / Continue. New Game warns before overwriting an existing save.
##
## Advancing to gameplay loads next_scene (the day loader). Continue resumes from
## the save GameManager already wrote; New Game wipes it first.

@export_file("*.tscn") var next_scene: String = "res://scenes/main.tscn"
@export var logo_skip_grace: float = 1.0  # ignore taps this long so a stray tap can't skip instantly

@onready var _video: VideoStreamPlayer = $Video
@onready var _white_void: ColorRect = $WhiteVoid
@onready var _map: Sprite2D = $MapLayer/Map
@onready var _presents: Label = $Presents
@onready var _title_kanji: TextureRect = $Title/Kanji
@onready var _title_en: TextureRect = $Title/English
@onready var _menu: Control = $Menu
@onready var _new_game_btn: Button = $Menu/VBox/NewGame
@onready var _continue_btn: Button = $Menu/VBox/Continue
@onready var _confirm: ConfirmationDialog = $OverwriteConfirm

var _phase := "logo"
var _elapsed := 0.0
var _done := false


func _ready() -> void:
	# Everything hidden except the video to start.
	_white_void.modulate.a = 0.0
	_presents.modulate.a = 0.0
	_title_kanji.modulate.a = 0.0
	_title_en.modulate.a = 0.0
	_menu.visible = false
	_map.scale = Vector2.ZERO

	_video.finished.connect(_on_logo_done)
	_video.play()

	_new_game_btn.pressed.connect(_on_new_game)
	_continue_btn.pressed.connect(_on_continue)
	_confirm.confirmed.connect(_start_new_game)

	# Continue is only meaningful if a save exists.
	_continue_btn.disabled = not _has_save()


func _process(delta: float) -> void:
	_elapsed += delta


func _unhandled_input(event: InputEvent) -> void:
	# Only the logo phase is tap-to-skip; later phases run their tweens.
	if _phase != "logo":
		return
	if _elapsed < logo_skip_grace:
		return
	var pressed: bool = (
		(event is InputEventKey and event.pressed)
		or (event is InputEventMouseButton and event.pressed)
		or (event is InputEventScreenTouch and event.pressed)
	)
	if pressed:
		_on_logo_done()


# ── Phase 1 → 2: logo finished (or skipped) ─────────────────────────────────
func _on_logo_done() -> void:
	if _phase != "logo":
		return
	_phase = "presents"
	_video.stop()
	_video.visible = false
	_run_presents()


# ── Phase 2: "presents" ─────────────────────────────────────────────────────
func _run_presents() -> void:
	var t := create_tween()
	t.tween_property(_presents, "modulate:a", 1.0, 0.8)
	t.tween_interval(1.1)
	t.tween_property(_presents, "modulate:a", 0.0, 0.6)
	t.tween_callback(_run_flash)


# ── Phase 3: flash to white — and STAY white (the game's void is white) ──────
func _run_flash() -> void:
	_phase = "flash"
	var t := create_tween()
	# Snap to white quickly; the white void remains as the backdrop the house
	# map spins into. We never fade it back out.
	t.tween_property(_white_void, "modulate:a", 1.0, 0.12)
	t.tween_callback(_begin_map_spin)


# ── Phase 4: house map spins out of the void ────────────────────────────────
func _begin_map_spin() -> void:
	_phase = "map"
	_map.scale = Vector2.ZERO
	_map.rotation = 0.0
	var t := create_tween().set_parallel(true)
	# Zoom in from nothing to full, easing out (fast then settling).
	t.tween_property(_map, "scale", _map_target_scale(), 2.4) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	# Spin several turns, decelerating to a stop as it arrives.
	t.tween_property(_map, "rotation", TAU * 3.0, 2.4) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.chain().tween_callback(_run_title)


func _map_target_scale() -> Vector2:
	# Fit the map to cover the viewport height with a slight overscan so the
	# spin never shows black corners at rest.
	var vp := get_viewport().get_visible_rect().size
	var tex := _map.texture.get_size()
	if tex.x == 0 or tex.y == 0:
		return Vector2.ONE
	var s: float = max(vp.x / tex.x, vp.y / tex.y) * 1.05
	return Vector2(s, s)


# ── Phase 5: title cards ────────────────────────────────────────────────────
func _run_title() -> void:
	_phase = "title"
	var t := create_tween()
	t.tween_property(_title_kanji, "modulate:a", 1.0, 0.9)
	t.tween_property(_title_en, "modulate:a", 1.0, 0.7)
	t.tween_interval(0.4)
	t.tween_callback(_show_menu)


# ── Phase 6: menu ───────────────────────────────────────────────────────────
func _show_menu() -> void:
	_phase = "menu"
	_menu.modulate.a = 0.0
	_menu.visible = true
	create_tween().tween_property(_menu, "modulate:a", 1.0, 0.5)


func _on_new_game() -> void:
	if _has_save():
		_confirm.popup_centered()
	else:
		_start_new_game()


func _start_new_game() -> void:
	# Wipe ALL in-memory state + delete the save so the game boots fresh at Day 1.
	# reset_for_dev() already does exactly this (clears every flag + removes the
	# save file); reuse it rather than duplicate the reset list.
	if GameManager.has_method("reset_for_dev"):
		GameManager.reset_for_dev()
	else:
		_delete_save()
	_go()


func _on_continue() -> void:
	_go()  # GameManager loads the existing save on boot.


func _go() -> void:
	if _done:
		return
	_done = true
	if next_scene != "" and ResourceLoader.exists(next_scene):
		get_tree().change_scene_to_file(next_scene)


# ── Save helpers ────────────────────────────────────────────────────────────
const SAVE_PATH := "user://save_data.json"

func _has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)

func _delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
		# user:// removal via DirAccess on the user dir:
		var d := DirAccess.open("user://")
		if d and d.file_exists("save_data.json"):
			d.remove("save_data.json")
