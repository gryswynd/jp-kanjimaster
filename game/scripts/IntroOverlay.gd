extends CanvasLayer
## New-game opening sequence — a cosmic cold-open on the white void.
##
## Black Japanese over English, beat by beat: a "They" unmade a star-filled
## universe down to this blank white nothing and lay down to sleep — then, at
## that same moment, high-schooler りきぞう finishes his first Japanese lesson.
## "Welcome to Day 1." The white is the void the rest of the game lives in; the
## pivot to Rikizo is the game's thesis (language re-creates the world).
##
## DayLoader calls play() only on a fresh game (not resuming). The overlay sits
## above everything (layer 18) and consumes taps; DayLoader freezes the player
## via GameManager.in_conversation for the duration. Reuses the fade / tap-skip /
## on_end-callback pattern of the other overlays. Audio: a low dread drone under
## the dire beats, a warm chime on the pivot to Rikizo.

const BEATS := [
	# DIRE — cosmic erasure (drone underneath).
	{"jp": "そして、塵は静かに沈んだ。",
	 "en": "And the dust settled.", "tone": "dire", "hold": 3.2},
	{"jp": "彼らは、望んだものを成し遂げた。",
	 "en": "They had done what they set out to do.", "tone": "dire", "hold": 3.2},
	{"jp": "かつて、星と惑星に満ちた、果てなき黒い宇宙。",
	 "en": "Once, an endless black universe, full of stars and planets.", "tone": "dire", "hold": 3.6},
	{"jp": "それは今、何もない、真っ白な虚空となった。",
	 "en": "Now — a blank white void. Nothing left.", "tone": "dire", "hold": 3.6},
	{"jp": "ようやく……眠れる。",
	 "en": "At last… they could sleep.", "tone": "dire", "hold": 3.4},
	# PIVOT → plucky (chime; warmth against the silence).
	{"jp": "——ちょうど、その時。",
	 "en": "—At that very same moment.", "tone": "plucky", "hold": 2.6},
	{"jp": "りきぞうという高校生が、ノートパソコンの向こうの二人のアメリカ人に、はじめての日本語の授業を終えた。",
	 "en": "A high-schooler named Rikizo finished his very first Japanese lesson — teaching two Americans through his laptop.", "tone": "plucky", "hold": 4.6},
	{"jp": "「またね！」",
	 "en": "\"See you next time!\"", "tone": "plucky", "hold": 2.6},
	{"jp": "ようこそ、一日目へ。",
	 "en": "Welcome to Day 1.", "tone": "plucky", "hold": 3.0},
]

var _bg: ColorRect
var _box: VBoxContainer
var _jp: Label
var _en: Label
var _hint: Label
var _drone: AudioStreamPlayer
var _chime: AudioStreamPlayer

var _on_end: Callable = Callable()
var _running := false
var _tapped := false
var _accept_tap := false
var _pivoted := false


func _ready() -> void:
	layer = 18  # above every other overlay
	_build_ui()
	visible = false


func _build_ui() -> void:
	_bg = ColorRect.new()
	_bg.color = Color(0.95, 0.95, 0.94)  # the void — a touch warm of pure white
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_bg)

	# Text band: 84% of the viewport wide (anchors → adapts to any window/device),
	# centered vertically. Labels autowrap inside it, so even the long Rikizo line
	# never spills off-screen.
	_box = VBoxContainer.new()
	_box.anchor_left = 0.08
	_box.anchor_right = 0.92
	_box.anchor_top = 0.5
	_box.anchor_bottom = 0.5
	_box.offset_top = -240.0
	_box.offset_bottom = 240.0
	_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_box.add_theme_constant_override("separation", 16)
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_box.modulate.a = 0.0
	add_child(_box)

	_jp = Label.new()
	_jp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_jp.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_jp.add_theme_font_size_override("font_size", 38)
	_jp.add_theme_color_override("font_color", Color(0.07, 0.07, 0.09))
	_box.add_child(_jp)

	_en = Label.new()
	_en.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_en.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_en.add_theme_font_size_override("font_size", 21)
	_en.add_theme_color_override("font_color", Color(0.42, 0.42, 0.46))
	_box.add_child(_en)

	# "tap to continue" hint — bottom-center, gently pulsing while we wait.
	_hint = Label.new()
	_hint.text = "tap to continue  ▸"
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.anchor_left = 0.0
	_hint.anchor_right = 1.0
	_hint.anchor_top = 1.0
	_hint.anchor_bottom = 1.0
	_hint.offset_top = -64.0
	_hint.offset_bottom = -28.0
	_hint.add_theme_font_size_override("font_size", 18)
	_hint.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hint.modulate.a = 0.0
	add_child(_hint)

	_drone = AudioStreamPlayer.new()
	if ResourceLoader.exists("res://assets/audio/intro_drone.wav"):
		_drone.stream = load("res://assets/audio/intro_drone.wav")
		# Loop so a slow reader never outlasts the drone during the dire beats.
		if _drone.stream is AudioStreamWAV:
			var w: AudioStreamWAV = _drone.stream
			w.loop_mode = AudioStreamWAV.LOOP_FORWARD
			w.loop_begin = 0
			w.loop_end = w.data.size() / 2  # 16-bit mono → samples = bytes / 2
	_drone.volume_db = -6.0
	add_child(_drone)

	_chime = AudioStreamPlayer.new()
	if ResourceLoader.exists("res://assets/audio/intro_chime.wav"):
		_chime.stream = load("res://assets/audio/intro_chime.wav")
	_chime.volume_db = -3.0
	add_child(_chime)


func play(on_end: Callable = Callable()) -> void:
	if _running:
		return
	_on_end = on_end
	_running = true
	_pivoted = false
	visible = true
	_bg.modulate.a = 1.0
	_box.modulate.a = 0.0
	if _drone.stream:
		_drone.volume_db = -40.0
		_drone.play()
		create_tween().tween_property(_drone, "volume_db", -6.0, 1.2)
	_run()


func _run() -> void:
	for b in BEATS:
		_jp.text = str(b.get("jp", ""))
		_en.text = str(b.get("en", ""))
		if str(b.get("tone", "")) == "plucky" and not _pivoted:
			_pivoted = true
			_fade_drone()
			if _chime.stream:
				_chime.play()
		await _fade(_box, 1.0, 0.6)
		await _wait_for_tap()
		await _fade(_box, 0.0, 0.4)
	await _fade(_bg, 0.0, 0.9)  # dissolve the void into Day 1
	if _drone.playing:
		_drone.stop()
	visible = false
	_running = false
	var cb := _on_end
	_on_end = Callable()
	if cb.is_valid():
		cb.call()


func _fade(node: CanvasItem, to_a: float, dur: float) -> void:
	var tw := create_tween()
	tw.tween_property(node, "modulate:a", to_a, dur)
	await tw.finished


func _wait_for_tap() -> void:
	# Click/tap to proceed — no auto-advance (one-time sequence; slow readers set
	# their own pace). A short cooldown stops the tap that revealed this beat from
	# instantly skipping it; then the hint pulses until the next tap.
	_tapped = false
	_accept_tap = false
	await get_tree().create_timer(0.35).timeout
	_accept_tap = true
	var pulse := create_tween().set_loops()
	pulse.tween_property(_hint, "modulate:a", 0.9, 0.7)
	pulse.tween_property(_hint, "modulate:a", 0.3, 0.7)
	while not _tapped:
		await get_tree().create_timer(0.03).timeout
	pulse.kill()
	_hint.modulate.a = 0.0
	_accept_tap = false


func _fade_drone() -> void:
	if not _drone.playing:
		return
	var tw := create_tween()
	tw.tween_property(_drone, "volume_db", -40.0, 1.2)
	tw.tween_callback(_drone.stop)


func _input(event: InputEvent) -> void:
	if not _running or not _accept_tap:
		return
	var tap: bool = (event is InputEventMouseButton and event.pressed) \
		or (event is InputEventScreenTouch and event.pressed) \
		or event.is_action_pressed("interact") \
		or (event is InputEventKey and event.pressed and not event.echo)
	if tap:
		_tapped = true
		get_viewport().set_input_as_handled()
