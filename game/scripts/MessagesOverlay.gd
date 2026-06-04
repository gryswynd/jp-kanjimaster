extends CanvasLayer
## Phone Messages app — list of conversation threads.
## Each row shows the contact's avatar, name, last-line preview, and a red
## dot if the thread has unread messages. Tapping a row opens that
## ConversationOverlay.

@export var on_open_thread: Callable  # Callable that takes contact_id: String

var _backdrop: ColorRect
var _panel: PanelContainer
var _thread_list: VBoxContainer
var _empty_label: Label


func _ready() -> void:
	layer = 16  # above PhoneOverlay (13) + WalletOverlay (15)
	visible = false
	_build_ui()
	GameManager.messages_changed.connect(_refresh)


func _build_ui() -> void:
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_backdrop_input)
	add_child(_backdrop)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(320, 480)
	_panel.size = Vector2(320, 480)
	_panel.position = Vector2(-160, -240)

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
	wallpaper.content_margin_left = 14
	wallpaper.content_margin_right = 14
	wallpaper.content_margin_top = 18
	wallpaper.content_margin_bottom = 14
	screen.add_theme_stylebox_override("panel", wallpaper)
	_panel.add_child(screen)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	screen.add_child(v)

	var title := Label.new()
	title.text = "メッセージ"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18))
	v.add_child(title)

	var rule := ColorRect.new()
	rule.color = Color(0.12, 0.14, 0.18, 0.20)
	rule.custom_minimum_size = Vector2(0, 1)
	v.add_child(rule)

	_thread_list = VBoxContainer.new()
	_thread_list.add_theme_constant_override("separation", 4)
	_thread_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(_thread_list)

	_empty_label = Label.new()
	_empty_label.text = "メッセージは ありません。\nNo messages yet."
	_empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty_label.add_theme_font_size_override("font_size", 12)
	_empty_label.add_theme_color_override("font_color", Color(0.4, 0.4, 0.45))
	_thread_list.add_child(_empty_label)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 13)
	close.custom_minimum_size = Vector2(110, 30)
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_messages)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	v.add_child(close_row)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_messages()


func open_messages() -> void:
	_refresh()
	visible = true


func close_messages() -> void:
	visible = false


func _refresh() -> void:
	for c in _thread_list.get_children():
		if c == _empty_label:
			continue
		c.queue_free()

	if GameManager.messages.is_empty():
		_empty_label.visible = true
		return
	_empty_label.visible = false

	for thread in GameManager.messages:
		_thread_list.add_child(_make_thread_row(thread))


func _make_thread_row(thread: Dictionary) -> Control:
	var row_btn := Button.new()
	row_btn.flat = true
	row_btn.custom_minimum_size = Vector2(0, 72)
	row_btn.focus_mode = Control.FOCUS_NONE
	row_btn.pressed.connect(_on_thread_pressed.bind(thread.get("contact_id", "")))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_btn.add_child(h)

	# Avatar — small thumbnail next to the row text
	var avatar_rect := TextureRect.new()
	avatar_rect.custom_minimum_size = Vector2(36, 36)
	avatar_rect.size = Vector2(36, 36)
	avatar_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	avatar_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	avatar_rect.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	avatar_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var avatar_path: String = str(thread.get("avatar", ""))
	if avatar_path != "" and ResourceLoader.exists(avatar_path):
		avatar_rect.texture = load(avatar_path) as Texture2D
	avatar_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(avatar_rect)

	# Name + preview
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(col)

	var name_lbl := Label.new()
	name_lbl.text = str(thread.get("contact_name_jp", ""))
	name_lbl.add_theme_font_size_override("font_size", 18)
	name_lbl.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18))
	col.add_child(name_lbl)

	var last_line := ""
	var lines: Array = thread.get("lines", [])
	if not lines.is_empty():
		last_line = str(lines[-1].get("jp", ""))
	var preview := Label.new()
	preview.text = last_line
	preview.add_theme_font_size_override("font_size", 14)
	preview.add_theme_color_override("font_color", Color(0.4, 0.4, 0.45))
	preview.clip_text = true
	col.add_child(preview)

	# Unread dot
	if thread.get("unread", false):
		var dot := ColorRect.new()
		dot.color = Color(0.95, 0.20, 0.20)
		dot.custom_minimum_size = Vector2(12, 12)
		dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var dot_wrap := CenterContainer.new()
		dot_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
		dot_wrap.add_child(dot)
		h.add_child(dot_wrap)

	return row_btn


func _on_thread_pressed(contact_id: String) -> void:
	if on_open_thread.is_valid():
		on_open_thread.call(contact_id)
