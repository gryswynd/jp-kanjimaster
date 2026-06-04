extends CanvasLayer
## Quest log overlay — list of open and completed quests.
## Opens via the Q key (or a future HUD button). Re-renders on
## GameManager.quest_changed.

var _backdrop: ColorRect
var _panel: PanelContainer
var _list_label: RichTextLabel


func _ready() -> void:
	layer = 14
	visible = false
	_build_ui()
	GameManager.quest_changed.connect(_refresh)


func _build_ui() -> void:
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_backdrop_input)
	add_child(_backdrop)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(700, 440)
	_panel.size = Vector2(700, 440)
	_panel.position = Vector2(-350, -220)

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
	vbox.add_theme_constant_override("separation", 12)
	margin.add_child(vbox)

	var title := Label.new()
	title.text = "クエスト / Quest Log"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(title)

	var divider := HSeparator.new()
	vbox.add_child(divider)

	_list_label = RichTextLabel.new()
	_list_label.bbcode_enabled = true
	_list_label.fit_content = true
	_list_label.scroll_active = false
	_list_label.add_theme_font_size_override("normal_font_size", 18)
	_list_label.add_theme_color_override("default_color", Color(0.15, 0.10, 0.05))
	_list_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(_list_label)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 16)
	close.custom_minimum_size = Vector2(140, 36)
	close.pressed.connect(close_log)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	vbox.add_child(close_row)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_log()


func open_log() -> void:
	_refresh()
	visible = true


func close_log() -> void:
	visible = false


func _refresh() -> void:
	var lines := []
	if GameManager.quests.is_empty():
		lines.append("[i]まだクエストはありません。[/i]")
		lines.append("[i]No quests yet.[/i]")
	else:
		var open_q := []
		var done_q := []
		for q in GameManager.quests:
			if q.get("status") == "complete":
				done_q.append(q)
			else:
				open_q.append(q)

		if not open_q.is_empty():
			lines.append("[b]Open[/b]")
			for q in open_q:
				lines.append("◻  %s" % GameManager.quest_render_jp(q))
				lines.append("    [color=#7a6855]%s[/color]" % GameManager.quest_render_en(q))
			lines.append("")
		if not done_q.is_empty():
			lines.append("[b]Done[/b]")
			for q in done_q:
				lines.append("✅  %s  [color=#7a6855](Day %d)[/color]" % [
					GameManager.quest_render_jp(q), int(q.get("completedDay", 0))
				])

	_list_label.clear()
	_list_label.append_text("\n".join(lines))
