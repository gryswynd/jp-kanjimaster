extends CanvasLayer
## Full-month calendar overlay. Shows the month containing the current
## in-game date. Previous days are X'd out (greyed); today is highlighted;
## future days are neutral. Each day cell is tappable — clicking it shows
## the per-character schedule for that date in the panel below the grid.

const DAY_KANJI := ["日","月","火","水","木","金","土"]
const DAY_EN    := ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

# Characters shown on the schedule panel. Same placeholders as before —
# "いる" everywhere until vocab unlocks for home/work/yasumi.
const CHARACTERS := [
	{"jp": "お母さん", "en": "Mom"},
	{"jp": "お父さん", "en": "Dad"},
	{"jp": "りきぞう",   "en": "Rikizo"},
]

# Per-day schedule overrides — day_number → { character_jp → activity_jp }.
# Anything not overridden defaults to "いる" (at home). These entries are
# Rikizo's OUT-OF-HOME days: they show ??? on the calendar until the player
# actually reaches that day, then they reveal the real location.
const SCHEDULE_OVERRIDES := {
	5: {"りきぞう": "コンビニ"},
	6: {"りきぞう": "川"},
	8: {"りきぞう": "コンビニ"},
}

var _backdrop: ColorRect
var _panel: PanelContainer
var _title_label: Label
var _header_row: GridContainer  # day-of-week label header (hidden on Day 2 strip view)
var _grid: GridContainer

# Day-detail popup (shown on top of the grid when a date cell is tapped).
var _detail_dim: ColorRect
var _detail_panel: PanelContainer
var _detail_title: Label
var _detail_subtitle: Label
var _detail_schedule: RichTextLabel
var _selected_day: int = 1


func _ready() -> void:
	layer = 12
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
	_panel.custom_minimum_size = Vector2(620, 420)
	_panel.size = Vector2(620, 420)
	_panel.position = Vector2(-310, -210)

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
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	margin.add_child(vbox)

	_title_label = Label.new()
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_font_size_override("font_size", 18)
	_title_label.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(_title_label)

	# Day-of-week header row (separate from grid for fixed positioning).
	_header_row = GridContainer.new()
	_header_row.columns = 7
	_header_row.add_theme_constant_override("h_separation", 3)
	for i in range(7):
		var lbl := Label.new()
		lbl.text = DAY_KANJI[i]
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.custom_minimum_size = Vector2(64, 22)
		lbl.add_theme_font_size_override("font_size", 13)
		if i == 0:
			lbl.add_theme_color_override("font_color", Color(0.7, 0.2, 0.2))  # Sun = red
		elif i == 6:
			lbl.add_theme_color_override("font_color", Color(0.2, 0.3, 0.7))  # Sat = blue
		else:
			lbl.add_theme_color_override("font_color", Color(0.35, 0.27, 0.18))
		_header_row.add_child(lbl)
	vbox.add_child(_header_row)

	_grid = GridContainer.new()
	_grid.columns = 7
	_grid.add_theme_constant_override("h_separation", 3)
	_grid.add_theme_constant_override("v_separation", 3)
	vbox.add_child(_grid)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 14)
	close.custom_minimum_size = Vector2(100, 30)
	close.pressed.connect(close_calendar)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	vbox.add_child(close_row)

	add_child(_panel)
	_build_detail_popup()


func _build_detail_popup() -> void:
	## A small card that pops over the grid when a day cell is tapped.
	## Has its own dim layer so tapping outside closes JUST the detail,
	## not the entire calendar.
	_detail_dim = ColorRect.new()
	_detail_dim.color = Color(0, 0, 0, 0.35)
	_detail_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_detail_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_detail_dim.visible = false
	_detail_dim.gui_input.connect(_on_detail_dim_input)
	add_child(_detail_dim)

	_detail_panel = PanelContainer.new()
	_detail_panel.set_anchors_preset(Control.PRESET_CENTER)
	_detail_panel.custom_minimum_size = Vector2(340, 240)
	_detail_panel.size = Vector2(340, 240)
	_detail_panel.position = Vector2(-170, -120)
	_detail_panel.visible = false

	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1.0, 0.99, 0.95)
	sb.border_color = Color(0.4, 0.3, 0.18)
	sb.border_width_left = 3
	sb.border_width_top = 3
	sb.border_width_right = 3
	sb.border_width_bottom = 3
	sb.corner_radius_top_left = 12
	sb.corner_radius_top_right = 12
	sb.corner_radius_bottom_right = 12
	sb.corner_radius_bottom_left = 12
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 10
	sb.shadow_offset = Vector2(0, 4)
	_detail_panel.add_theme_stylebox_override("panel", sb)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_bottom", 14)
	_detail_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	margin.add_child(vbox)

	_detail_title = Label.new()
	_detail_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_detail_title.add_theme_font_size_override("font_size", 18)
	_detail_title.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(_detail_title)

	_detail_subtitle = Label.new()
	_detail_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_detail_subtitle.add_theme_font_size_override("font_size", 13)
	_detail_subtitle.add_theme_color_override("font_color", Color(0.5, 0.42, 0.28))
	vbox.add_child(_detail_subtitle)

	var dv := HSeparator.new()
	vbox.add_child(dv)

	_detail_schedule = RichTextLabel.new()
	_detail_schedule.bbcode_enabled = true
	_detail_schedule.fit_content = true
	_detail_schedule.scroll_active = false
	_detail_schedule.add_theme_font_size_override("normal_font_size", 14)
	_detail_schedule.add_theme_color_override("default_color", Color(0.15, 0.10, 0.05))
	_detail_schedule.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(_detail_schedule)

	var close_detail := Button.new()
	close_detail.text = "とじる"
	close_detail.add_theme_font_size_override("font_size", 13)
	close_detail.custom_minimum_size = Vector2(90, 28)
	close_detail.pressed.connect(_close_detail)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close_detail)
	vbox.add_child(close_row)

	add_child(_detail_panel)


func _on_detail_dim_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_close_detail()


func _close_detail() -> void:
	_detail_dim.visible = false
	_detail_panel.visible = false


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_calendar()


func open_calendar() -> void:
	_selected_day = GameManager.current_day
	_refresh()
	visible = true


func _refresh() -> void:
	# Day 2 shows just a week strip (no date numbers) — the player hasn't
	# learned numbers yet. From Day 3 on, full month grid with past days X'd.
	if GameManager.current_day < 3:
		_refresh_week_view()
	else:
		_refresh_month_view()


func _refresh_month_view() -> void:
	_header_row.visible = true
	var today_date: Dictionary = GameManager.get_current_date()
	var month: int = today_date["month"]
	var year: int  = today_date["year"]
	_title_label.text = "%s / %s %d" % [GameManager.MONTH_NAMES_JP[month - 1], GameManager.MONTH_NAMES_EN[month - 1], year]

	_grid.columns = 7
	for c in _grid.get_children():
		c.queue_free()

	var days_in_month: int = GameManager.MONTH_LENGTHS_2026[month - 1]
	var first_weekday: int = _weekday_for_date(year, month, 1)

	for i in range(first_weekday):
		var spacer := Control.new()
		spacer.custom_minimum_size = Vector2(64, 40)
		_grid.add_child(spacer)

	for d in range(1, days_in_month + 1):
		_grid.add_child(_make_day_cell(year, month, d, today_date))


func _refresh_week_view() -> void:
	## Day 2: seven weekday-kanji cells, today's weekday highlighted.
	## No date numbers shown. The standalone day-of-week header row is
	## hidden because each cell already carries its kanji.
	_header_row.visible = false
	_title_label.text = "ようび / Days of the Week"

	_grid.columns = 7
	for c in _grid.get_children():
		c.queue_free()

	var today_date: Dictionary = GameManager.get_current_date()
	var today_weekday: int = int(today_date["weekday"])

	for i in range(7):
		_grid.add_child(_make_weekday_cell(i, today_weekday))


func _make_weekday_cell(weekday_idx: int, today_weekday: int) -> Control:
	var btn := Button.new()
	btn.text = DAY_KANJI[weekday_idx]
	btn.custom_minimum_size = Vector2(64, 56)
	btn.add_theme_font_size_override("font_size", 22)

	var sb := StyleBoxFlat.new()
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.corner_radius_top_left = 6
	sb.corner_radius_top_right = 6
	sb.corner_radius_bottom_right = 6
	sb.corner_radius_bottom_left = 6
	sb.border_color = Color(0.55, 0.45, 0.30)

	if weekday_idx == today_weekday:
		sb.bg_color = Color(1.0, 0.85, 0.4)
		btn.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	else:
		sb.bg_color = Color(0.94, 0.90, 0.80)
		if weekday_idx == 0:
			btn.add_theme_color_override("font_color", Color(0.7, 0.2, 0.2))
		elif weekday_idx == 6:
			btn.add_theme_color_override("font_color", Color(0.2, 0.3, 0.7))
		else:
			btn.add_theme_color_override("font_color", Color(0.15, 0.10, 0.05))

	btn.add_theme_stylebox_override("normal", sb)
	btn.add_theme_stylebox_override("hover", sb.duplicate())
	btn.add_theme_stylebox_override("pressed", sb.duplicate())

	# Tapping a weekday in week-view shows the schedule for today only —
	# there are no specific dates to pick yet.
	btn.pressed.connect(_on_weekday_pressed.bind(weekday_idx))
	return btn


func _on_weekday_pressed(_weekday_idx: int) -> void:
	# Day 2 has no date numbers, so all taps just show today's schedule.
	_selected_day = GameManager.current_day
	_show_day_detail()


func _weekday_for_date(year: int, month: int, day: int) -> int:
	## Compute weekday (0=Sun..6=Sat) for an arbitrary Y/M/D within our
	## supported window by walking from the start_date constant.
	var offset := _days_between(
		GameManager.START_YEAR, GameManager.START_MONTH, GameManager.START_DAY,
		year, month, day
	)
	# GDScript's % returns negative for negative dividends — normalize to [0, 6].
	return ((GameManager.START_WEEKDAY + offset) % 7 + 7) % 7


func _days_between(y1: int, m1: int, d1: int, y2: int, m2: int, d2: int) -> int:
	## Returns y2/m2/d2 minus y1/m1/d1 in days. Negative if target is earlier
	## than start. Keeps math simple for the POC (assumes 2026 window).
	if _is_before(y2, m2, d2, y1, m1, d1):
		return -_days_between(y2, m2, d2, y1, m1, d1)
	var n := 0
	while y1 != y2 or m1 != m2 or d1 != d2:
		d1 += 1
		if d1 > GameManager.MONTH_LENGTHS_2026[m1 - 1]:
			d1 = 1
			m1 += 1
			if m1 > 12:
				m1 = 1
				y1 += 1
		n += 1
	return n


func _is_before(y1: int, m1: int, d1: int, y2: int, m2: int, d2: int) -> bool:
	if y1 != y2:
		return y1 < y2
	if m1 != m2:
		return m1 < m2
	return d1 < d2


func _in_game_day_for_date(year: int, month: int, day: int) -> int:
	## Returns the in-game day number (1-based) for a given Y/M/D.
	return _days_between(
		GameManager.START_YEAR, GameManager.START_MONTH, GameManager.START_DAY,
		year, month, day
	) + 1


func _make_day_cell(year: int, month: int, day: int, today_date: Dictionary) -> Control:
	var btn := Button.new()
	btn.text = str(day)
	btn.custom_minimum_size = Vector2(64, 40)
	btn.add_theme_font_size_override("font_size", 14)

	# Style by past/today/future.
	var sb := StyleBoxFlat.new()
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.corner_radius_top_left = 6
	sb.corner_radius_top_right = 6
	sb.corner_radius_bottom_right = 6
	sb.corner_radius_bottom_left = 6
	sb.border_color = Color(0.55, 0.45, 0.30)

	var t_year: int = int(today_date["year"])
	var t_month: int = int(today_date["month"])
	var t_day: int = int(today_date["day"])
	var is_today: bool = (year == t_year and month == t_month and day == t_day)
	var is_past: bool = false
	if year < t_year:
		is_past = true
	elif year == t_year and month < t_month:
		is_past = true
	elif year == t_year and month == t_month and day < t_day:
		is_past = true

	if is_today:
		sb.bg_color = Color(1.0, 0.85, 0.4)  # warm yellow today highlight
		btn.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	elif is_past:
		sb.bg_color = Color(0.78, 0.74, 0.66)  # greyed
		btn.add_theme_color_override("font_color", Color(0.5, 0.45, 0.4))
		# Strike-through visual: prepend an X over the number.
		btn.text = "%d ✕" % day
	else:
		sb.bg_color = Color(0.94, 0.90, 0.80)
		btn.add_theme_color_override("font_color", Color(0.15, 0.10, 0.05))

	btn.add_theme_stylebox_override("normal", sb)
	btn.add_theme_stylebox_override("hover", sb.duplicate())
	btn.add_theme_stylebox_override("pressed", sb.duplicate())

	var day_number = _in_game_day_for_date(year, month, day)
	btn.pressed.connect(_on_day_pressed.bind(day_number))
	return btn


func _on_day_pressed(day_number: int) -> void:
	_selected_day = day_number
	_show_day_detail()


func _show_day_detail() -> void:
	var date := GameManager.get_date_for_day(_selected_day)
	var weekday_idx: int = int(date["weekday"])
	if GameManager.current_day < 3:
		# Day 2: no date numbers yet — just the weekday.
		_detail_title.text = "%sようび" % DAY_KANJI[weekday_idx]
		_detail_subtitle.text = DAY_EN[weekday_idx]
	else:
		_detail_title.text = "%d月%d日（%sようび）" % [date["month"], date["day"], DAY_KANJI[weekday_idx]]
		_detail_subtitle.text = "%s %d, %d (%s)" % [GameManager.MONTH_NAMES_EN[date["month"] - 1], date["day"], date["year"], DAY_EN[weekday_idx]]
	var lines := []
	var overrides: Dictionary = SCHEDULE_OVERRIDES.get(_selected_day, {})
	for ch in CHARACTERS:
		var activity: String
		# Rikizo's out-of-home days stay hidden as ？？？ until the player
		# reaches that day. Home days (no override) and Mom/Dad always show
		# their known location.
		if overrides.has(ch["jp"]) and _selected_day > GameManager.current_day:
			activity = "？？？"
		else:
			activity = overrides.get(ch["jp"], "いる")
		lines.append("%s：%s" % [ch["jp"], activity])
	_detail_schedule.clear()
	_detail_schedule.append_text("\n".join(lines))
	_detail_dim.visible = true
	_detail_panel.visible = true


func close_calendar() -> void:
	visible = false
	if _detail_panel:
		_detail_panel.visible = false
	if _detail_dim:
		_detail_dim.visible = false
