extends CanvasLayer
## Cinematic CG player — "approach 1" action animation.
##
## Plays a still character ACTION CUTOUT (magenta-keyed transparent PNG)
## floating over the current location's convo background, animated with
## camera motion + onomatopoeia, so one cutout asset is reusable in any
## location. Used for eat/drink beats and other action moments.
##
## Usage:
##   cg_overlay.play(
##       bg_key,          # convo-bg key for the location ("" = dim only)
##       cutout_path,     # res:// path to the action cutout PNG
##       onomatopoeia,    # e.g. "もぐもぐ" / "ごくごく" ("" = none)
##       on_end,          # Callable run after the cinematic finishes
##       fx               # "water" (droplet sparkle) / "rice" (specks) / ""
##   )

var _backdrop: ColorRect
var _bg: TextureRect
var _cutout: TextureRect
var _onoma: Label
var _particles: CPUParticles2D
var _dot_tex: Texture2D

var _on_end: Callable = Callable()
var _playing := false
var _seq: Tween


func _ready() -> void:
	layer = 13  # above gameplay + most overlays, below hard-modal dialogs
	visible = false
	_build_ui()


func _build_ui() -> void:
	# Backdrop dim (also catches the whole screen for tap-to-skip).
	_backdrop = ColorRect.new()
	_backdrop.name = "Backdrop"
	_backdrop.color = Color(0, 0, 0, 1)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_input)
	add_child(_backdrop)

	# Location background (convo bg), fills the screen behind the cutout.
	_bg = TextureRect.new()
	_bg.name = "BG"
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_bg)

	# The action cutout, centered. Scaled/pivoted for the slow zoom.
	_cutout = TextureRect.new()
	_cutout.name = "Cutout"
	_cutout.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cutout.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_cutout.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_cutout.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cutout)

	# Onomatopoeia text that pops over the action (もぐもぐ / ごくごく).
	_onoma = Label.new()
	_onoma.name = "Onoma"
	_onoma.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_onoma.offset_left = -300
	_onoma.offset_right = 300
	_onoma.offset_top = 120
	_onoma.offset_bottom = 240
	_onoma.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_onoma.add_theme_font_size_override("font_size", 96)
	_onoma.add_theme_color_override("font_color", Color(1, 1, 1))
	_onoma.add_theme_color_override("font_outline_color", Color(0.1, 0.1, 0.12))
	_onoma.add_theme_constant_override("outline_size", 12)
	_onoma.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_onoma)

	# Particle FX (water sparkle / rice specks). Procedural soft-dot texture
	# — no art assets needed. Positioned over the action focal point.
	_dot_tex = _make_dot_texture()
	_particles = CPUParticles2D.new()
	_particles.name = "Particles"
	_particles.texture = _dot_tex
	_particles.emitting = false
	_particles.one_shot = true
	_particles.explosiveness = 0.65
	_particles.lifetime = 0.95
	_particles.amount = 28
	# Emit point sits roughly where the mouth / item is (upper-center).
	var vp := get_viewport().get_visible_rect().size
	_particles.position = Vector2(vp.x * 0.5, vp.y * 0.42)
	_particles.local_coords = false
	add_child(_particles)


func _make_dot_texture(size: int = 20) -> Texture2D:
	## A soft round white dot built in code — tinted per-fx via the
	## particle color. Avoids shipping any sprite asset.
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var c := size / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x + 0.5 - c, y + 0.5 - c).length() / c
			var a := clampf(1.0 - d, 0.0, 1.0)
			a = a * a  # softer falloff toward the edge
			img.set_pixel(x, y, Color(1, 1, 1, a))
	return ImageTexture.create_from_image(img)


func _config_fx(fx: String) -> void:
	## Tune the emitter for the action. No-op (and no emit) for fx == "".
	if fx == "":
		return
	_particles.direction = Vector2(0, -1)
	_particles.spread = 55.0
	_particles.gravity = Vector2(0, 520)   # arc up then fall
	_particles.angular_velocity_min = -220.0
	_particles.angular_velocity_max = 220.0
	if fx == "water":
		# Sparkly droplets — cool blue-white, fast, twinkly, additive glow.
		_particles.amount = 30
		_particles.initial_velocity_min = 180.0
		_particles.initial_velocity_max = 340.0
		_particles.scale_amount_min = 0.5
		_particles.scale_amount_max = 1.1
		_particles.color = Color(0.7, 0.9, 1.0, 0.95)
		var grad := Gradient.new()
		grad.set_color(0, Color(0.85, 0.95, 1.0, 1.0))
		grad.set_color(1, Color(0.6, 0.8, 1.0, 0.0))
		_particles.color_ramp = grad
	elif fx == "rice":
		# Rice bits — cream/white, chunkier, tumbling, heavier fall.
		_particles.amount = 22
		_particles.initial_velocity_min = 140.0
		_particles.initial_velocity_max = 280.0
		_particles.scale_amount_min = 0.9
		_particles.scale_amount_max = 1.6
		_particles.color = Color(0.98, 0.96, 0.86, 1.0)
		var grad2 := Gradient.new()
		grad2.set_color(0, Color(1.0, 0.98, 0.9, 1.0))
		grad2.set_color(1, Color(0.95, 0.92, 0.8, 0.0))
		_particles.color_ramp = grad2


func play(bg_key: String, cutout_path: String, onomatopoeia: String = "", on_end: Callable = Callable(), fx: String = "") -> void:
	if _playing:
		return
	_playing = true
	_on_end = on_end
	_config_fx(fx)
	_particles.emitting = false  # reset; bursts on the onomatopoeia beat

	# Background: the location's convo bg if known, else a soft dark wash.
	if bg_key != "" and GameManager.convo_backgrounds.has(bg_key):
		_bg.texture = GameManager.convo_backgrounds[bg_key]
		_bg.visible = true
	else:
		_bg.visible = false

	if ResourceLoader.exists(cutout_path):
		_cutout.texture = load(cutout_path) as Texture2D
	_onoma.text = onomatopoeia

	# Initial state.
	visible = true
	_backdrop.modulate.a = 0.0
	_bg.modulate.a = 0.0
	_cutout.modulate.a = 0.0
	_cutout.pivot_offset = _cutout.size * 0.5
	_cutout.scale = Vector2(1.04, 1.04)
	_onoma.modulate.a = 0.0
	_onoma.scale = Vector2(0.6, 0.6)
	_onoma.pivot_offset = Vector2(_onoma.size.x * 0.5, _onoma.size.y * 0.5)

	if _seq and _seq.is_valid():
		_seq.kill()
	_seq = create_tween()
	# 1. Fade in backdrop + bg + cutout together.
	_seq.set_parallel(true)
	_seq.tween_property(_backdrop, "modulate:a", 0.6, 0.35)
	_seq.tween_property(_bg, "modulate:a", 1.0, 0.35)
	_seq.tween_property(_cutout, "modulate:a", 1.0, 0.45)
	# Slow continuous zoom on the cutout across the whole beat.
	_seq.tween_property(_cutout, "scale", Vector2(1.16, 1.16), 2.6)\
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	# 2. Onomatopoeia pop shortly after the cutout lands.
	_seq.set_parallel(false)
	_seq.tween_interval(0.55)
	if onomatopoeia != "":
		# Particle burst lands with the text pop (the eat/drink moment).
		if fx != "":
			_seq.tween_callback(_burst)
		_seq.set_parallel(true)
		_seq.tween_property(_onoma, "modulate:a", 1.0, 0.18)
		_seq.tween_property(_onoma, "scale", Vector2(1.0, 1.0), 0.28)\
			.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		_seq.set_parallel(false)
		# A second little bob to read as chewing/gulping, with a 2nd burst.
		_seq.tween_interval(0.35)
		if fx != "":
			_seq.tween_callback(_burst)
		_seq.tween_property(_onoma, "scale", Vector2(1.12, 1.12), 0.18)\
			.set_trans(Tween.TRANS_SINE)
		_seq.tween_property(_onoma, "scale", Vector2(1.0, 1.0), 0.18)\
			.set_trans(Tween.TRANS_SINE)
	# 3. Hold on the satisfied beat.
	_seq.tween_interval(0.9)
	# 4. Fade everything out, then finish.
	_seq.set_parallel(true)
	_seq.tween_property(_onoma, "modulate:a", 0.0, 0.4)
	_seq.tween_property(_cutout, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_bg, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_backdrop, "modulate:a", 0.0, 0.5)
	_seq.set_parallel(false)
	_seq.tween_callback(_finish)


func _burst() -> void:
	# One-shot CPUParticles2D: restart() replays the burst.
	if _particles:
		_particles.restart()
		_particles.emitting = true


func _on_input(event: InputEvent) -> void:
	# Tap / interact / Enter skips straight to the end.
	var skip := false
	if event is InputEventMouseButton and event.pressed:
		skip = true
	elif event is InputEventKey and event.pressed and not event.echo:
		skip = true
	if skip and _playing:
		_finish()


func _finish() -> void:
	if not _playing:
		return
	_playing = false
	if _seq and _seq.is_valid():
		_seq.kill()
	visible = false
	var cb := _on_end
	_on_end = Callable()
	if cb.is_valid():
		cb.call()
