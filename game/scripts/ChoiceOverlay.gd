extends CanvasLayer
## Reusable yes/no choice prompt with cream styling matching the
## dialog bubble. Call `ask(question, on_yes, on_no)` from anywhere
## to pose a binary choice; player movement is paused while it's open.

var _backdrop: ColorRect
var _panel: PanelContainer
var _jp_label: Label
var _en_label: Label
var _yes_btn: Button
var _no_btn: Button

var _on_yes: Callable
var _on_no: Callable


func _ready() -> void:
	layer = 13  # above calendar (12) so a calendar+choice combo would stack right
	visible = false
	_build_ui()


func _build_ui() -> void:
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_backdrop)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(520, 240)
	_panel.size = Vector2(520, 240)
	_panel.position = Vector2(-260, -120)

	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.98, 0.96, 0.91)
	sb.border_color = Color(0.35, 0.27, 0.18)
	sb.border_width_left = 3
	sb.border_width_top = 3
	sb.border_width_right = 3
	sb.border_width_bottom = 3
	sb.corner_radius_top_left = 14
	sb.corner_radius_top_right = 14
	sb.corner_radius_bottom_right = 14
	sb.corner_radius_bottom_left = 14
	sb.shadow_color = Color(0, 0, 0, 0.4)
	sb.shadow_size = 8
	sb.shadow_offset = Vector2(0, 4)
	_panel.add_theme_stylebox_override("panel", sb)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 14)
	margin.add_child(vbox)

	_jp_label = Label.new()
	_jp_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_jp_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_jp_label.add_theme_font_size_override("font_size", 24)
	_jp_label.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(_jp_label)

	_en_label = Label.new()
	_en_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_en_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_en_label.add_theme_font_size_override("font_size", 16)
	_en_label.add_theme_color_override("font_color", Color(0.4, 0.32, 0.22))
	vbox.add_child(_en_label)

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 4)
	vbox.add_child(spacer)

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 18)
	vbox.add_child(hbox)

	_yes_btn = Button.new()
	_yes_btn.text = "はい / Yes"
	_yes_btn.custom_minimum_size = Vector2(160, 48)
	_yes_btn.add_theme_font_size_override("font_size", 18)
	_yes_btn.pressed.connect(_on_yes_pressed)
	hbox.add_child(_yes_btn)

	_no_btn = Button.new()
	_no_btn.text = "いいえ / No"
	_no_btn.custom_minimum_size = Vector2(160, 48)
	_no_btn.add_theme_font_size_override("font_size", 18)
	_no_btn.pressed.connect(_on_no_pressed)
	hbox.add_child(_no_btn)

	add_child(_panel)


func ask(question: Dictionary, on_yes: Callable, on_no: Callable = Callable()) -> void:
	_jp_label.text = str(question.get("jp", ""))
	_en_label.text = str(question.get("en", ""))
	_on_yes = on_yes
	_on_no = on_no
	# Block player movement and other interactions while the prompt is up.
	GameManager.in_conversation = true
	visible = true


func _on_yes_pressed() -> void:
	var cb := _on_yes
	_close()
	if cb.is_valid():
		cb.call()


func _on_no_pressed() -> void:
	var cb := _on_no
	_close()
	if cb.is_valid():
		cb.call()


func _close() -> void:
	visible = false
	GameManager.in_conversation = false
	# Brief lockout so the same input frame doesn't re-trigger the source
	# interactable (same pattern GameManager.end_conversation uses).
	GameManager._interaction_lockout_until = Time.get_ticks_msec() + 250
	_on_yes = Callable()
	_on_no = Callable()
