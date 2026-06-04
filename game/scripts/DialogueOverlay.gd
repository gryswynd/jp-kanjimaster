extends CanvasLayer
## Conversation overlay — speech bubble + character portrait + background.
## Supports per-conversation backgrounds and per-speaker portrait overrides.

@onready var overlay: ColorRect = $Overlay
@onready var speech_text: RichTextLabel = $Overlay/SpeechBubble/SpeechMargin/SpeechVBox/SpeechText
@onready var en_text: Label = $Overlay/SpeechBubble/SpeechMargin/SpeechVBox/EnText
@onready var continue_label: Label = $Overlay/SpeechBubble/SpeechMargin/SpeechVBox/ContinueLabel
@onready var portrait: TextureRect = $Overlay/Portrait
@onready var bg_texture_rect: TextureRect = $Overlay/Background
@onready var speech_bubble: PanelContainer = $Overlay/SpeechBubble

var conversation: Array = []
var conversation_index: int = 0
var portrait_map: Dictionary = {}
var portrait_overrides: Dictionary = {}  # speaker → Texture2D
var on_end_callback: Callable


func _ready() -> void:
	overlay.visible = false
	GameManager.conversation_started.connect(_on_conversation_started)
	GameManager.conversation_ended.connect(_on_conversation_ended)

	# Create background TextureRect if it doesn't exist in the scene
	if not bg_texture_rect:
		bg_texture_rect = TextureRect.new()
		bg_texture_rect.name = "Background"
		bg_texture_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
		bg_texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg_texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		overlay.add_child(bg_texture_rect)
		overlay.move_child(bg_texture_rect, 0)

	# Keep the speech bubble + portrait clear of device notches / home indicator
	# (iPhone Dynamic Island in landscape sits on the left edge and was covering
	# the start of the Japanese line). No-op on Switch/Deck/desktop (insets = 0).
	_apply_safe_area()
	var sa := get_node_or_null("/root/SafeArea")
	if sa and sa.has_signal("changed"):
		sa.changed.connect(_apply_safe_area)


# Nudge the bubble in from the left/bottom safe-area insets and the portrait in
# from the right inset. These are layout offsets ADDED on top of the scene's
# anchor-based positions, so on inset-free platforms nothing moves.
func _apply_safe_area() -> void:
	var sa := get_node_or_null("/root/SafeArea")
	if sa == null:
		return
	var i: Dictionary = sa.insets()
	if speech_bubble:
		speech_bubble.offset_left = i.get("left", 0.0)
		speech_bubble.offset_bottom = -i.get("bottom", 0.0)
	if portrait:
		portrait.offset_right = -i.get("right", 0.0)
		portrait.offset_top = i.get("top", 0.0)


func set_portrait_map(map: Dictionary) -> void:
	portrait_map = map


func _on_conversation_started(convo_data: Array, options: Dictionary) -> void:
	conversation = convo_data
	conversation_index = 0

	# Portrait overrides for this conversation
	portrait_overrides = options.get("portrait_overrides", {})

	# On-end callback
	if options.has("on_end"):
		on_end_callback = options["on_end"]
	else:
		on_end_callback = Callable()

	# Set background
	var bg_key: String = options.get("background", "")
	if bg_key != "" and GameManager.convo_backgrounds.has(bg_key):
		bg_texture_rect.texture = GameManager.convo_backgrounds[bg_key]
		bg_texture_rect.visible = true
	elif not GameManager.convo_backgrounds.is_empty():
		# Fallback to first available background
		bg_texture_rect.texture = GameManager.convo_backgrounds.values()[0]
		bg_texture_rect.visible = true
	else:
		bg_texture_rect.visible = false

	overlay.visible = true
	_display_line()


func _on_conversation_ended() -> void:
	overlay.visible = false
	conversation = []
	conversation_index = 0
	portrait_overrides = {}

	if on_end_callback.is_valid():
		var cb := on_end_callback
		on_end_callback = Callable()
		cb.call()


func _display_line() -> void:
	if conversation_index >= conversation.size():
		GameManager.end_conversation()
		return

	var line: Dictionary = conversation[conversation_index]
	var jp: String = str(line.get("jp", line.get("text", "")))
	var en: String = str(line.get("en", ""))
	var speaker: String = str(line.get("speaker", ""))

	# Plain text — `add_text` skips BBCode parsing entirely (no chip styling,
	# no [url] taps); translation is shown in the EN label beneath instead.
	speech_text.clear()
	speech_text.add_text(jp)

	en_text.text = en

	# Last line gets a distinct cue so the player knows tapping again will close
	if conversation_index == conversation.size() - 1:
		continue_label.text = "Tap to close ✕"
	else:
		continue_label.text = "Tap to continue ▶"

	# Set portrait — priority order:
	#   1. per-line override `line.portrait` (highest — for swapping
	#      mid-conversation, e.g. mom calm for setup → exasperated for the punch)
	#   2. per-conversation override (portrait_overrides[speaker])
	#   3. default portrait_map[speaker]
	var portrait_tex = null
	if line.has("portrait") and line["portrait"] is Texture2D:
		portrait_tex = line["portrait"]
	if portrait_tex == null:
		portrait_tex = portrait_overrides.get(speaker)
	if portrait_tex == null:
		portrait_tex = portrait_map.get(speaker)
	if portrait_tex is Texture2D:
		portrait.texture = portrait_tex as Texture2D
		portrait.visible = true
	else:
		portrait.visible = false

	# Per-line background swap — lets a single conversation switch rooms
	# mid-flow (e.g. Rikizo at the genkan → Mom calling from the kitchen).
	# `line.background` is a key into GameManager.convo_backgrounds.
	if line.has("background"):
		var bg_key: String = str(line["background"])
		if bg_key != "" and GameManager.convo_backgrounds.has(bg_key):
			bg_texture_rect.texture = GameManager.convo_backgrounds[bg_key]
			bg_texture_rect.visible = true


func advance() -> void:
	conversation_index += 1
	_display_line()


func _unhandled_input(event: InputEvent) -> void:
	if not GameManager.in_conversation:
		return

	if event.is_action_pressed("interact"):
		advance()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed:
		advance()
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenTouch and event.pressed:
		advance()
		get_viewport().set_input_as_handled()
