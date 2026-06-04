extends CanvasLayer
## Mobile touch input: a floating virtual joystick for movement + tap-to-interact.
##
## • Press-and-drag anywhere → a joystick appears under your thumb; drag to steer.
##   Feeds an analog vector to the player (Player.set_touch_vector).
## • A quick tap that doesn't turn into a drag → "interact" (talk to whoever
##   you're next to / pick up / examine). Conversations advance on ANY tap, so a
##   player can never get stuck in dialogue.
## • Releasing the joystick stops movement.
##
## Replaces the old d-pad + single A button. Keyboard input still works in
## parallel (Player reads it first), so desktop + future Steam Deck are unaffected.

const STICK_RADIUS := 70.0      # max thumb travel from the joystick origin
const DEAD_ZONE := 0.18         # fraction of radius ignored (prevents jitter)
const TAP_MAX_MOVE := 16.0      # px of drift still counted as a "tap", not a drag
const TAP_MAX_TIME := 0.35      # seconds; longer holds are a joystick, not a tap
const BASE_ALPHA := 0.28

var _player: Node = null
var _touch_index := -1          # which finger owns the joystick (-1 = none)
var _origin := Vector2.ZERO
var _cur := Vector2.ZERO
var _start_time := 0.0
var _moved := false

var _ring: Control = null       # the joystick base ring
var _knob: Control = null       # the draggable knob


func _ready() -> void:
	layer = 20
	if not DisplayServer.is_touchscreen_available():
		visible = false
		set_process_input(false)
		return
	_build_joystick_visual()
	# Hide the stick during conversations; taps still advance dialogue (handled
	# in _input, which stays active).
	if GameManager.has_signal("conversation_started"):
		GameManager.conversation_started.connect(func(_a, _b): _release_stick())


func _player_node() -> Node:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
	return _player


func _build_joystick_visual() -> void:
	_ring = _make_circle(STICK_RADIUS * 2.0, Color(1, 1, 1, BASE_ALPHA * 0.6))
	_knob = _make_circle(STICK_RADIUS * 0.9, Color(1, 1, 1, BASE_ALPHA))
	_ring.visible = false
	_knob.visible = false
	add_child(_ring)
	add_child(_knob)


func _make_circle(diameter: float, color: Color) -> Control:
	var tr := TextureRect.new()
	var r := int(diameter)
	var img := Image.create(r, r, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var cx := r * 0.5
	var rad := r * 0.5
	for y in range(r):
		for x in range(r):
			var d := Vector2(x - cx, y - cx).length()
			# Soft filled disc with a slightly brighter rim.
			if d <= rad:
				var a := color.a
				if d > rad - 3.0:
					a = color.a * 1.6
				img.set_pixel(x, y, Color(color.r, color.g, color.b, min(a, 1.0)))
	tr.texture = ImageTexture.create_from_image(img)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.size = Vector2(diameter, diameter)
	return tr


func _input(event: InputEvent) -> void:
	# Conversations: ANY tap/click advances. This is the anti-soft-lock guarantee
	# and runs whether or not the joystick is visible.
	if GameManager.in_conversation:
		var is_press: bool = (event is InputEventScreenTouch and event.pressed) \
			or (event is InputEventMouseButton and event.pressed)
		if is_press:
			_advance_conversation()
			get_viewport().set_input_as_handled()
		return

	# --- Touch joystick ---
	if event is InputEventScreenTouch:
		if event.pressed and _touch_index == -1:
			_begin_touch(event.index, event.position)
		elif not event.pressed and event.index == _touch_index:
			_end_touch(event.position)
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_update_touch(event.position)
	# Mouse fallback (desktop testing of the touch path).
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed and _touch_index == -1:
			_begin_touch(-2, event.position)
		elif not event.pressed and _touch_index == -2:
			_end_touch(event.position)
	elif event is InputEventMouseMotion and _touch_index == -2:
		_update_touch(event.position)


func _begin_touch(index: int, pos: Vector2) -> void:
	_touch_index = index
	_origin = pos
	_cur = pos
	_start_time = float(Time.get_ticks_msec()) / 1000.0
	_moved = false
	_ring.position = pos - _ring.size * 0.5
	_knob.position = pos - _knob.size * 0.5
	_ring.visible = true
	_knob.visible = true


func _update_touch(pos: Vector2) -> void:
	_cur = pos
	var delta := pos - _origin
	if delta.length() > TAP_MAX_MOVE:
		_moved = true
	# Clamp knob to the ring radius and feed the analog vector to the player.
	var clamped := delta.limit_length(STICK_RADIUS)
	_knob.position = _origin + clamped - _knob.size * 0.5
	var mag := clamped.length() / STICK_RADIUS
	var vec := Vector2.ZERO
	if mag > DEAD_ZONE:
		vec = clamped.normalized() * ((mag - DEAD_ZONE) / (1.0 - DEAD_ZONE))
	var p := _player_node()
	if p and p.has_method("set_touch_vector"):
		p.set_touch_vector(vec)


func _end_touch(pos: Vector2) -> void:
	var held := float(Time.get_ticks_msec()) / 1000.0 - _start_time
	var drifted := (pos - _origin).length()
	# A short, low-drift press = a tap → interact.
	if not _moved and held <= TAP_MAX_TIME and drifted <= TAP_MAX_MOVE:
		_do_interact()
	_release_stick()


func _release_stick() -> void:
	_touch_index = -1
	_moved = false
	if _ring: _ring.visible = false
	if _knob: _knob.visible = false
	var p := _player_node()
	if p and p.has_method("set_touch_vector"):
		p.set_touch_vector(Vector2.ZERO)


func _do_interact() -> void:
	var p := _player_node()
	if p and p.has_signal("interaction_requested"):
		p.interaction_requested.emit()


func _advance_conversation() -> void:
	# Prefer the dialogue overlay's own advance(); fall back to nothing.
	var dlg := get_tree().get_first_node_in_group("dialogue_overlay")
	if dlg == null:
		# DialogueOverlay isn't grouped; find by name under the scene root.
		var root := get_tree().current_scene
		if root:
			dlg = root.get_node_or_null("DialogueOverlay")
	if dlg and dlg.has_method("advance"):
		dlg.advance()
