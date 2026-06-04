extends CanvasLayer
## Tap-to-pay overlay — purchase / vending micro-cinematic.
##
## Slides a large smartphone in from the left and an IC payment terminal
## in from the right. They converge at center, white flash + 「ピッ」
## onomatopoeia + amount badge (-¥N), brief hold, fade. Reusable for
## konbini purchases, vending machines, and any future shop transaction.
##
## Same staging family as CgOverlay — anime cel-shaded cutouts composited
## over an optional location bg — but with a different motion (two
## sprites converging) and a different vocab (ピッ, not もぐもぐ).
##
## Usage:
##   tap_to_pay.play(
##       150,                      # amount in yen (shown as -¥150)
##       "konbini-outside",        # convo bg key for ambient context ("" = dim)
##       func():                   # on_end — typically does the actual
##           GameManager.spend_yen(150)
##           GameManager.add_item(item)
##   )

## Phone texture is no longer a fixed path — it's resolved per-play from
## the player's currently equipped phone case (see GameManager phone case
## registry). Terminal is still a single shared sprite.
const TERMINAL_PATH := "res://assets/ui/tap_to_pay/payment_terminal.png"

var _backdrop: ColorRect
var _bg: TextureRect
var _phone: TextureRect
var _terminal: TextureRect
var _flash: ColorRect
var _onoma: Label
var _amount: Label

var _on_end: Callable = Callable()
var _playing := false
var _seq: Tween


func _ready() -> void:
	layer = 13  # same band as CgOverlay; above gameplay + most overlays
	visible = false
	_build_ui()


func _build_ui() -> void:
	# Dim backdrop catches tap-to-skip + dims gameplay underneath.
	_backdrop = ColorRect.new()
	_backdrop.name = "Backdrop"
	_backdrop.color = Color(0, 0, 0, 1)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_input)
	add_child(_backdrop)

	# Optional location bg (konbini, etc.) — fills screen behind sprites.
	_bg = TextureRect.new()
	_bg.name = "BG"
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_bg)

	# Phone sprite (starts off-screen left, slides right toward center).
	_phone = TextureRect.new()
	_phone.name = "Phone"
	_phone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_phone.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_phone.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_phone)

	# Terminal sprite (starts off-screen right, slides left toward center).
	_terminal = TextureRect.new()
	_terminal.name = "Terminal"
	_terminal.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_terminal.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_terminal.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_terminal)

	# White full-screen flash punched at the moment of contact.
	_flash = ColorRect.new()
	_flash.name = "Flash"
	_flash.color = Color(1, 1, 1, 0)
	_flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_flash)

	# 「ピッ」 onomatopoeia pop on contact — same TRANS_BACK bounce as
	# the CgOverlay onomatopoeia for stylistic consistency.
	_onoma = Label.new()
	_onoma.name = "Onoma"
	_onoma.text = "ピッ"
	_onoma.add_theme_font_size_override("font_size", 128)
	_onoma.add_theme_color_override("font_color", Color(1, 1, 1))
	_onoma.add_theme_color_override("font_outline_color", Color(0.08, 0.4, 0.7))
	_onoma.add_theme_constant_override("outline_size", 14)
	_onoma.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_onoma.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_onoma)

	# -¥N amount badge under the meeting point — warm yellow with a dark
	# outline so it pops against any background.
	_amount = Label.new()
	_amount.name = "Amount"
	_amount.add_theme_font_size_override("font_size", 72)
	_amount.add_theme_color_override("font_color", Color(1, 0.9, 0.3))
	_amount.add_theme_color_override("font_outline_color", Color(0.1, 0.05, 0))
	_amount.add_theme_constant_override("outline_size", 10)
	_amount.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_amount.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_amount)


func play(amount: int, bg_key: String = "", on_end: Callable = Callable()) -> void:
	if _playing:
		return
	_playing = true
	_on_end = on_end

	# Background: the location's convo bg if known, else dim only.
	if bg_key != "" and GameManager.convo_backgrounds.has(bg_key):
		_bg.texture = GameManager.convo_backgrounds[bg_key]
		_bg.visible = true
	else:
		_bg.visible = false

	# Sprites (loaded each play so a missing asset doesn't crash _ready).
	# Phone sprite is resolved from the currently equipped phone case so
	# swapping cases changes what tap-to-pay shows.
	var phone_tex := GameManager.get_phone_texture_large()
	if phone_tex:
		_phone.texture = phone_tex
	if ResourceLoader.exists(TERMINAL_PATH):
		_terminal.texture = load(TERMINAL_PATH) as Texture2D

	# Sizes / positions relative to current viewport. Square 1024×1024
	# source sprites displayed at ~50% of viewport height.
	var vp := get_viewport().get_visible_rect().size
	var sprite_h := vp.y * 0.5
	var sprite_w := sprite_h
	var cy := vp.y * 0.5 - sprite_h * 0.5
	# Targets: PHONE sits to the RIGHT of center, TERMINAL sits to the
	# LEFT — they slide toward each other with slight overlap at center.
	# Terminal is flipped horizontally (its painted reader-face was
	# angled left-ish for the original right-side layout) so the tap
	# zone now faces the incoming phone from the east.
	var phone_target_x := vp.x * 0.5 - sprite_w * 0.15    # right of center
	var terminal_target_x := vp.x * 0.5 - sprite_w * 0.85  # left of center

	_phone.size = Vector2(sprite_w, sprite_h)
	_terminal.size = Vector2(sprite_w, sprite_h)
	_phone.position = Vector2(vp.x + sprite_w * 0.1, cy)       # off-screen RIGHT now
	_terminal.position = Vector2(-sprite_w * 1.1, cy)          # off-screen LEFT now

	# Flip the terminal horizontally so its tap face presents to the
	# RIGHT (toward the phone coming in from the east). pivot_offset
	# keeps the flip centered so the position math above still aligns.
	_terminal.pivot_offset = Vector2(sprite_w * 0.5, sprite_h * 0.5)
	_terminal.scale = Vector2(-1.0, 1.0)
	_phone.pivot_offset = Vector2(sprite_w * 0.5, sprite_h * 0.5)
	_phone.scale = Vector2(1.0, 1.0)

	# Labels positioned around the meeting point.
	var meet_x := vp.x * 0.5
	_onoma.size = Vector2(800, 200)
	_onoma.position = Vector2(meet_x - 400, cy - 180)
	_onoma.pivot_offset = Vector2(_onoma.size.x * 0.5, _onoma.size.y * 0.5)
	_amount.text = "-¥%d" % amount
	_amount.size = Vector2(600, 120)
	_amount.position = Vector2(meet_x - 300, cy + sprite_h + 10)
	_amount.pivot_offset = Vector2(_amount.size.x * 0.5, _amount.size.y * 0.5)

	# Initial visibility / alpha state.
	visible = true
	_backdrop.modulate.a = 0.0
	_bg.modulate.a = 0.0
	_flash.color.a = 0.0
	_onoma.modulate.a = 0.0
	_onoma.scale = Vector2(0.5, 0.5)
	_amount.modulate.a = 0.0
	_amount.scale = Vector2(0.7, 0.7)
	_phone.modulate.a = 1.0
	_terminal.modulate.a = 1.0

	if _seq and _seq.is_valid():
		_seq.kill()
	_seq = create_tween()

	# 1. Dim in.
	_seq.set_parallel(true)
	_seq.tween_property(_backdrop, "modulate:a", 0.7, 0.35)
	_seq.tween_property(_bg, "modulate:a", 1.0, 0.35)
	_seq.set_parallel(false)

	# 2. Sprites slide in toward center (decelerating ease-out).
	_seq.set_parallel(true)
	_seq.tween_property(_phone, "position:x", phone_target_x, 0.85)\
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_seq.tween_property(_terminal, "position:x", terminal_target_x, 0.85)\
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_seq.set_parallel(false)

	# 3. Contact: white flash + ピッ pop + amount badge appear together.
	_seq.tween_callback(_flash_pop)
	_seq.set_parallel(true)
	_seq.tween_property(_onoma, "modulate:a", 1.0, 0.2)
	_seq.tween_property(_onoma, "scale", Vector2(1.0, 1.0), 0.32)\
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_seq.tween_property(_amount, "modulate:a", 1.0, 0.25)
	_seq.tween_property(_amount, "scale", Vector2(1.0, 1.0), 0.32)\
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_seq.set_parallel(false)

	# 4. Hold on the satisfied-purchase beat.
	_seq.tween_interval(1.25)

	# 5. Fade everything out, then finish.
	_seq.set_parallel(true)
	_seq.tween_property(_onoma, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_amount, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_phone, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_terminal, "modulate:a", 0.0, 0.5)
	_seq.tween_property(_bg, "modulate:a", 0.0, 0.55)
	_seq.tween_property(_backdrop, "modulate:a", 0.0, 0.55)
	_seq.set_parallel(false)
	_seq.tween_callback(_finish)


func _flash_pop() -> void:
	## Quick white flash punctuating the moment of contact. Runs on its
	## own tween so it can fade out independently of the main sequence.
	_flash.color = Color(1, 1, 1, 0.85)
	var t := create_tween()
	t.tween_property(_flash, "color:a", 0.0, 0.28)\
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


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
