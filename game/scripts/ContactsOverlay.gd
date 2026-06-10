extends CanvasLayer
## Phone Contacts app (れんらくさき) — Day 4+. A scrollable address book of the
## people Rikizo has MET (shop/service staff excluded; Tree-san only once
## unlocked; You always present). Tapping a row opens a full contact card:
## large photo, name, bio, status meters (したしさ closeness / いらだち annoyance
## for adults / おそれ paranoia for you only), and Rikizo's evolving notes.
## All values are read live from GameManager.CONTACTS + trackers — no state here.

var _backdrop: ColorRect
var _panel: PanelContainer
var _content: VBoxContainer  # swapped between list view and detail view


func _ready() -> void:
	layer = 16  # same tier as MessagesOverlay (they're never shown together)
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

	_content = VBoxContainer.new()
	_content.add_theme_constant_override("separation", 8)
	screen.add_child(_content)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_contacts()


func open_contacts() -> void:
	# Reading is per-person now: a contact clears only when you open THEIR card,
	# so the list can flash exactly who has a new memo.
	_show_list()
	visible = true


func close_contacts() -> void:
	visible = false


func _clear_content() -> void:
	for c in _content.get_children():
		c.queue_free()


# ─── List view ───────────────────────────────────────────────────────

func _show_list() -> void:
	_clear_content()

	var title := Label.new()
	title.text = "れんらくさき"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18))
	_content.add_child(title)

	var rule := ColorRect.new()
	rule.color = Color(0.12, 0.14, 0.18, 0.20)
	rule.custom_minimum_size = Vector2(0, 1)
	_content.add_child(rule)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_content.add_child(scroll)

	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 4)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(list)

	for def in GameManager.met_contacts():
		var row := _make_row(def)
		list.add_child(row)
		# Flash the row of anyone with a new (unviewed) memo so you see WHO updated.
		if GameManager.contact_has_unread(def):
			var tw := row.create_tween().set_loops(3)
			tw.tween_property(row, "modulate", Color(1.6, 1.6, 1.6, 1), 0.18)
			tw.tween_property(row, "modulate", Color(1, 1, 1, 1), 0.24)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 13)
	close.custom_minimum_size = Vector2(110, 30)
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_contacts)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	_content.add_child(close_row)


func _make_row(def: Dictionary) -> Control:
	var row_btn := Button.new()
	row_btn.flat = true
	row_btn.custom_minimum_size = Vector2(0, 60)
	row_btn.focus_mode = Control.FOCUS_NONE
	row_btn.pressed.connect(_show_detail.bind(def))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_btn.add_child(h)

	var avatar := TextureRect.new()
	avatar.custom_minimum_size = Vector2(40, 40)
	avatar.size = Vector2(40, 40)
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	avatar.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var photo := str(def.get("photo", ""))
	if photo != "" and ResourceLoader.exists(photo):
		avatar.texture = load(photo) as Texture2D
	avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(avatar)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 1)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(col)

	var name_lbl := Label.new()
	name_lbl.text = str(def.get("nameJp", ""))
	name_lbl.add_theme_font_size_override("font_size", 17)
	name_lbl.add_theme_color_override("font_color", Color(0.12, 0.14, 0.18))
	col.add_child(name_lbl)

	# No stats on the list — they live on the contact card. Self gets a small
	# "you" tag so it reads as your own entry.
	if bool(def.get("is_self", false)):
		var sub := Label.new()
		sub.text = "（あなた）"
		sub.add_theme_font_size_override("font_size", 12)
		sub.add_theme_color_override("font_color", Color(0.45, 0.47, 0.52))
		col.add_child(sub)

	# Red dot for a person with a new, unviewed memo (persists until you open them).
	if GameManager.contact_has_unread(def):
		var dot := ColorRect.new()
		dot.color = Color(0.95, 0.20, 0.20)
		dot.custom_minimum_size = Vector2(12, 12)
		dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var dot_wrap := CenterContainer.new()
		dot_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
		dot_wrap.add_child(dot)
		h.add_child(dot_wrap)

	return row_btn


# ─── Detail view (contact card) ──────────────────────────────────────

func _show_detail(def: Dictionary) -> void:
	_clear_content()
	GameManager.mark_contact_seen(def)  # opening a card clears that person's unread

	# Header: back button + name.
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 6)
	var back := Button.new()
	back.text = "← もどる"
	back.add_theme_font_size_override("font_size", 13)
	back.focus_mode = Control.FOCUS_NONE
	back.pressed.connect(_show_list)
	header.add_child(back)
	_content.add_child(header)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_content.add_child(scroll)

	# Right padding so meters / numbers / notes never sit under the scrollbar.
	var card_margin := MarginContainer.new()
	card_margin.add_theme_constant_override("margin_right", 12)
	card_margin.add_theme_constant_override("margin_left", 2)
	card_margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(card_margin)

	var card := VBoxContainer.new()
	card.add_theme_constant_override("separation", 8)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card_margin.add_child(card)

	# Large photo, centered.
	var photo := str(def.get("photo", ""))
	if photo != "" and ResourceLoader.exists(photo):
		var pic := TextureRect.new()
		pic.custom_minimum_size = Vector2(150, 150)
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.texture = load(photo) as Texture2D
		var pic_wrap := CenterContainer.new()
		pic_wrap.add_child(pic)
		card.add_child(pic_wrap)

	# Name (JP big / EN small), centered.
	var name_jp := Label.new()
	name_jp.text = str(def.get("nameJp", ""))
	name_jp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_jp.add_theme_font_size_override("font_size", 22)
	name_jp.add_theme_color_override("font_color", Color(0.10, 0.12, 0.16))
	card.add_child(name_jp)

	var name_en := Label.new()
	name_en.text = str(def.get("nameEn", ""))
	name_en.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_en.add_theme_font_size_override("font_size", 13)
	name_en.add_theme_color_override("font_color", Color(0.45, 0.47, 0.52))
	card.add_child(name_en)

	# Bio.
	var bio := Label.new()
	bio.text = str(def.get("bio_jp", "")) + "\n" + str(def.get("bio_en", ""))
	bio.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bio.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bio.add_theme_font_size_override("font_size", 13)
	bio.add_theme_color_override("font_color", Color(0.30, 0.32, 0.38))
	card.add_child(bio)

	card.add_child(_hrule())

	# Status meters.
	var rk := str(def.get("rel_key", ""))
	if bool(def.get("is_self", false)):
		card.add_child(_stat_meter("おそれ", "Dread", Color(0.55, 0.40, 0.75),
			GameManager.get_tracker("paranoia")))
	else:
		if rk != "":
			card.add_child(_stat_meter("したしさ", "Closeness", Color(0.88, 0.35, 0.46),
				GameManager.get_tracker("relationships", rk)))
		if bool(def.get("is_adult", false)) and rk != "":
			card.add_child(_stat_meter("いらだち", "Annoyance", Color(0.90, 0.55, 0.20),
				GameManager.get_tracker("annoyance", rk)))

	# Rikizo's notes.
	var notes: Array = GameManager.contact_notes(def)
	if not notes.is_empty():
		card.add_child(_hrule())
		var notes_title := Label.new()
		notes_title.text = "メモ"
		notes_title.add_theme_font_size_override("font_size", 14)
		notes_title.add_theme_color_override("font_color", Color(0.28, 0.42, 0.28))
		card.add_child(notes_title)
		var notes_en := Label.new()
		notes_en.text = "Notes"
		notes_en.add_theme_font_size_override("font_size", 10)
		notes_en.add_theme_color_override("font_color", Color(0.50, 0.58, 0.50))
		card.add_child(notes_en)
		for note in notes:
			var nl := Label.new()
			nl.text = "・" + str(note.get("jp", "")) + "\n　" + str(note.get("en", ""))
			nl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			nl.add_theme_font_size_override("font_size", 12)
			nl.add_theme_color_override("font_color", Color(0.22, 0.24, 0.30))
			card.add_child(nl)


# ─── Helpers ─────────────────────────────────────────────────────────

func _stat_meter(label_jp: String, label_en: String, color: Color, value: int) -> Control:
	## Level meter on GameManager's shared stat curve: a bar shows progress toward
	## the next level, with the exact value beside the level (left-aligned, clear
	## of the scrollbar). JP label with EN translation underneath.
	var info := GameManager.stat_level_info(value)
	var lvl: int = int(info["level"])
	var rem: int = int(info["into"])

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 8)

	# Label cell: JP on top, EN translation underneath.
	var label_col := VBoxContainer.new()
	label_col.add_theme_constant_override("separation", 0)
	label_col.custom_minimum_size = Vector2(92, 0)
	var lbl := Label.new()
	lbl.text = label_jp
	lbl.add_theme_font_size_override("font_size", 15)
	lbl.add_theme_color_override("font_color", Color(0.20, 0.22, 0.28))
	label_col.add_child(lbl)
	var lbl_en := Label.new()
	lbl_en.text = label_en
	lbl_en.add_theme_font_size_override("font_size", 10)
	lbl_en.add_theme_color_override("font_color", Color(0.52, 0.54, 0.60))
	label_col.add_child(lbl_en)
	top.add_child(label_col)

	# Level + raw value, left-aligned right after the label (clear of scrollbar).
	var lvl_lbl := Label.new()
	lvl_lbl.text = "Lv.%d" % lvl
	lvl_lbl.add_theme_font_size_override("font_size", 16)
	lvl_lbl.add_theme_color_override("font_color", color)
	lvl_lbl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(lvl_lbl)

	var raw := Label.new()
	raw.text = "(%d)" % value
	raw.add_theme_font_size_override("font_size", 13)
	raw.add_theme_color_override("font_color", Color(0.40, 0.42, 0.48))
	raw.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(raw)
	box.add_child(top)

	var bar := ProgressBar.new()
	bar.max_value = int(info["span"])
	bar.value = rem
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, 8)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.85, 0.86, 0.88)
	bg.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("background", bg)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("fill", fill)
	box.add_child(bar)
	return box


func _hrule() -> Control:
	var rule := ColorRect.new()
	rule.color = Color(0.12, 0.14, 0.18, 0.15)
	rule.custom_minimum_size = Vector2(0, 1)
	return rule
