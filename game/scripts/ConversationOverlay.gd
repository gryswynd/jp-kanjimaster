extends CanvasLayer
## Phone Conversation app — shows a single message thread as chat bubbles.
## Header has the contact's avatar + name + back button (to the messages
## list). Incoming messages bubble on the left, outgoing on the right.
## Bubbles show JP on top + EN translation underneath.

@export var on_back: Callable  # Called when player taps the back arrow

var _backdrop: ColorRect
var _panel: PanelContainer
var _header_avatar: TextureRect
var _header_name: Label
var _bubble_column: VBoxContainer

var _current_contact_id: String = ""
var _current_avatar_tex: Texture2D = null


func _ready() -> void:
	layer = 17  # above MessagesOverlay (16)
	visible = false
	_build_ui()


func _build_ui() -> void:
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_backdrop_input)
	add_child(_backdrop)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(440, 540)
	_panel.size = Vector2(440, 540)
	_panel.position = Vector2(-220, -270)

	var bezel := StyleBoxFlat.new()
	bezel.bg_color = Color(0.06, 0.07, 0.09)
	bezel.border_color = Color(0.02, 0.02, 0.03)
	bezel.border_width_left = 5
	bezel.border_width_top = 5
	bezel.border_width_right = 5
	bezel.border_width_bottom = 5
	bezel.corner_radius_top_left = 30
	bezel.corner_radius_top_right = 30
	bezel.corner_radius_bottom_right = 30
	bezel.corner_radius_bottom_left = 30
	bezel.shadow_color = Color(0, 0, 0, 0.55)
	bezel.shadow_size = 12
	bezel.shadow_offset = Vector2(0, 6)
	_panel.add_theme_stylebox_override("panel", bezel)

	var screen := PanelContainer.new()
	var wallpaper := StyleBoxFlat.new()
	wallpaper.bg_color = Color(0.96, 0.97, 0.99)
	wallpaper.corner_radius_top_left = 18
	wallpaper.corner_radius_top_right = 18
	wallpaper.corner_radius_bottom_right = 18
	wallpaper.corner_radius_bottom_left = 18
	wallpaper.content_margin_left = 10
	wallpaper.content_margin_right = 10
	wallpaper.content_margin_top = 10
	wallpaper.content_margin_bottom = 10
	screen.add_theme_stylebox_override("panel", wallpaper)
	_panel.add_child(screen)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	screen.add_child(v)

	# Header: back button | avatar | name
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	v.add_child(header)

	var back_btn := Button.new()
	back_btn.text = "‹"
	back_btn.add_theme_font_size_override("font_size", 22)
	back_btn.custom_minimum_size = Vector2(36, 36)
	back_btn.focus_mode = Control.FOCUS_NONE
	back_btn.pressed.connect(_on_back_pressed)
	header.add_child(back_btn)

	_header_avatar = TextureRect.new()
	_header_avatar.custom_minimum_size = Vector2(32, 32)
	_header_avatar.size = Vector2(32, 32)
	_header_avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_header_avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_header_avatar.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_header_avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(_header_avatar)

	_header_name = Label.new()
	_header_name.add_theme_font_size_override("font_size", 20)
	_header_name.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18))
	_header_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_header_name)

	var rule := ColorRect.new()
	rule.color = Color(0.12, 0.14, 0.18, 0.20)
	rule.custom_minimum_size = Vector2(0, 1)
	v.add_child(rule)

	# Bubbles scroll container
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)

	_bubble_column = VBoxContainer.new()
	_bubble_column.add_theme_constant_override("separation", 8)
	_bubble_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_bubble_column)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_on_back_pressed()


func _on_back_pressed() -> void:
	visible = false
	if on_back.is_valid():
		on_back.call()


func open_thread(contact_id: String) -> void:
	_current_contact_id = contact_id
	# Find the thread
	var thread = null
	for t in GameManager.messages:
		if t.get("contact_id", "") == contact_id:
			thread = t
			break
	if thread == null:
		return
	# Mark as read
	GameManager.mark_thread_read(contact_id)
	# Render header
	_current_avatar_tex = null
	var avatar_path: String = str(thread.get("avatar", ""))
	if avatar_path != "" and ResourceLoader.exists(avatar_path):
		_current_avatar_tex = load(avatar_path) as Texture2D
		_header_avatar.texture = _current_avatar_tex
	_header_name.text = str(thread.get("contact_name_jp", ""))
	# Render bubbles
	for c in _bubble_column.get_children():
		c.queue_free()
	for line in thread.get("lines", []):
		var is_incoming: bool = (str(line.get("from", "")) == contact_id)
		_bubble_column.add_child(_make_bubble(line, is_incoming))
	visible = true


func _make_bubble(line: Dictionary, is_incoming: bool) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	# Incoming bubble: avatar on the LEFT next to the bubble.
	# Outgoing bubble: spacer pushes it right (no avatar, since it's Rikizo).
	if is_incoming:
		var avatar := TextureRect.new()
		avatar.custom_minimum_size = Vector2(28, 28)
		avatar.size = Vector2(28, 28)
		avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		avatar.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		avatar.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		if _current_avatar_tex:
			avatar.texture = _current_avatar_tex
		row.add_child(avatar)
	else:
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

	var bubble := PanelContainer.new()
	# Cap bubble width so it doesn't fill the whole row — looks like a chat
	# bubble, not a banner. ~72% of panel content width.
	bubble.custom_minimum_size = Vector2(120, 0)
	bubble.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN if is_incoming else Control.SIZE_SHRINK_END
	var sb := StyleBoxFlat.new()
	if is_incoming:
		sb.bg_color = Color(0.92, 0.94, 0.96)
	else:
		sb.bg_color = Color(0.30, 0.66, 0.95)
	sb.border_color = Color(0.0, 0.0, 0.0, 0.12)
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.corner_radius_top_left = 16
	sb.corner_radius_top_right = 16
	sb.corner_radius_bottom_right = 16
	sb.corner_radius_bottom_left = 16
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	bubble.add_theme_stylebox_override("panel", sb)

	var bvb := VBoxContainer.new()
	bvb.add_theme_constant_override("separation", 4)
	bubble.add_child(bvb)

	var jp := Label.new()
	jp.text = str(line.get("jp", ""))
	jp.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	jp.custom_minimum_size = Vector2(280, 0)  # forces wrap inside max width
	jp.add_theme_font_size_override("font_size", 20)
	jp.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18) if is_incoming else Color(1, 1, 1))
	bvb.add_child(jp)

	var en_text := str(line.get("en", ""))
	if en_text != "":
		var en := Label.new()
		en.text = en_text
		en.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		en.add_theme_font_size_override("font_size", 14)
		en.add_theme_color_override("font_color", Color(0.4, 0.4, 0.45) if is_incoming else Color(0.85, 0.92, 1.0))
		bvb.add_child(en)

	row.add_child(bubble)

	# Outgoing bubble: avatar slot on the right (intentionally absent — keeps
	# spacing symmetric so the bubble doesn't shift jarringly relative to
	# incoming rows). Incoming rows get a trailing spacer instead.
	if is_incoming:
		var sp2 := Control.new()
		sp2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp2)

	return row
