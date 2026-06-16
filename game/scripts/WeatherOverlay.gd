extends CanvasLayer
## Screen-space weather overlay (Day 11+). Draws animated rain over the whole
## viewport — above the world (z 0–100) but below the HUD/UI — plus a faint
## overcast tint. Driven per in-game day by GameManager.weather_for_day();
## DayLoader gates it to outdoor scenes. Reuses CgOverlay's CPUParticles2D +
## procedural-texture approach (gl_compatibility safe, no art assets).

var _tint: ColorRect
var _rain: CPUParticles2D
var _kind := "clear"

const FALL_SPEED := 1000.0  # px/s, used to size lifetime to the viewport


func _ready() -> void:
	layer = 8  # above world, below HudOverlay(9)/DialogueOverlay(10)
	_build()
	set_weather("clear")


func _build() -> void:
	_tint = ColorRect.new()
	_tint.color = Color(0.45, 0.5, 0.62, 0.0)  # blue-grey overcast, faded in for rain
	_tint.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_tint)

	_rain = CPUParticles2D.new()
	_rain.texture = _make_streak_texture()
	_rain.emitting = false
	_rain.local_coords = false          # fall in screen space (camera-independent)
	_rain.amount = 220
	_rain.direction = Vector2(0.16, 1)  # slight diagonal
	_rain.spread = 4.0
	_rain.gravity = Vector2.ZERO
	_rain.initial_velocity_min = FALL_SPEED * 0.9
	_rain.initial_velocity_max = FALL_SPEED * 1.15
	_rain.scale_amount_min = 0.7
	_rain.scale_amount_max = 1.2
	_rain.color = Color(0.8, 0.86, 0.95, 0.5)
	_rain.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	add_child(_rain)
	_layout()


func _layout() -> void:
	# Emit across the full width just above the top edge; lifetime sized so a drop
	# crosses the whole viewport. emission_rect_extents are HALF-extents.
	var vp := get_viewport().get_visible_rect().size
	_rain.emission_rect_extents = Vector2(vp.x * 0.62, 4.0)  # >half-width to cover the diagonal lean
	_rain.position = Vector2(vp.x * 0.5, -24.0)
	_rain.lifetime = (vp.y + 120.0) / FALL_SPEED
	_rain.preprocess = _rain.lifetime  # pre-fill so the screen is already raining on show


func set_weather(kind: String) -> void:
	_kind = kind
	_layout()
	if kind == "rain":
		_rain.restart()       # re-runs preprocess → screen full of rain immediately
		_rain.emitting = true
		_fade_tint(0.12)
	else:  # "clear" (and any future-unhandled kind)
		_rain.emitting = false  # existing drops finish falling, then it's clear
		_fade_tint(0.0)


func _fade_tint(a: float) -> void:
	var tw := create_tween()
	tw.tween_property(_tint, "color:a", a, 0.8)


func _make_streak_texture() -> Texture2D:
	# A short vertical rain streak: bright center column, soft edges, faint
	# top→bottom falloff. 3×22 px, generated in code (no asset).
	var w := 3
	var h := 22
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var mid := (w - 1) / 2.0
	for y in h:
		for x in w:
			var across := 1.0 - absf(x - mid) / (mid + 0.5)
			var down := 1.0 - float(y) / float(h) * 0.35
			img.set_pixel(x, y, Color(1, 1, 1, clampf(across * down, 0.0, 1.0)))
	return ImageTexture.create_from_image(img)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED and _rain:
		_layout()
