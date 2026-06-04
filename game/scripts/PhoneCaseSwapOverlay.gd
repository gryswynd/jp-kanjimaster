extends CanvasLayer
## Phone case swap overlay — opens from the phone item in the inventory.
##
## Shows a grid of every owned phone case (small thumbnail + name). Tapping
## a case plays a brief swap animation (large case sprite + カチッ
## onomatopoeia + white flash, same staging family as TapToPayOverlay's
## contact moment), then calls GameManager.equip_phone_case() and closes
## itself. If the player taps the case that's already equipped, it just
## closes — no equip, no animation.
##
## Instantiated lazily by InventoryOverlay; frees itself after closing so
## the next invocation always sees a fresh state.

const ANIM_DURATION := 1.1  # seconds for the full swap animation (flash + onoma + hold + fade)

var _backdrop: ColorRect
var _picker_panel: PanelContainer
var _grid: GridContainer
var _anim_root: Control
var _anim_phone: TextureRect
var _anim_flash: ColorRect
var _anim_onoma: Label

var _on_closed: Callable = Callable()
var _animating := false


func _ready() -> void:
	layer = 15  # above InventoryOverlay (14)
	_build_ui()
	# This node is persistent in main.tscn, and CanvasLayer defaults to
	# visible — so without this it renders the picker on every scene load.
	# Only open_swap() (from the inventory's ケースをかえる button) shows it.
	visible = false


func _build_ui() -> void:
	# Dim backdrop — also catches a tap-outside-to-cancel.
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_backdrop_input)
	add_child(_backdrop)

	# Picker panel — centered, same warm beige styling as InventoryOverlay.
	_picker_panel = PanelContainer.new()
	_picker_panel.set_anchors_preset(Control.PRESET_CENTER)
	_picker_panel.custom_minimum_size = Vector2(520, 380)
	_picker_panel.size = Vector2(520, 380)
	_picker_panel.position = Vector2(-260, -190)

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
	_picker_panel.add_theme_stylebox_override("panel", sb)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	_picker_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	margin.add_child(vbox)

	var title := Label.new()
	title.text = "ケースを えらぶ / Choose a case"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(title)

	var divider := HSeparator.new()
	vbox.add_child(divider)

	_grid = GridContainer.new()
	_grid.columns = 3
	_grid.add_theme_constant_override("h_separation", 14)
	_grid.add_theme_constant_override("v_separation", 14)
	vbox.add_child(_grid)

	var hint := Label.new()
	hint.text = "ピックして かえる。"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", Color(0.4, 0.32, 0.22))
	vbox.add_child(hint)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 16)
	close.custom_minimum_size = Vector2(140, 36)
	close.pressed.connect(close_swap)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	vbox.add_child(close_row)

	add_child(_picker_panel)

	# Animation root — full-screen, hidden until a case is picked. Holds the
	# blown-up phone sprite + flash + カチッ label.
	_anim_root = Control.new()
	_anim_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_anim_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anim_root.visible = false
	add_child(_anim_root)

	_anim_phone = TextureRect.new()
	_anim_phone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_anim_phone.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_anim_phone.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anim_root.add_child(_anim_phone)

	_anim_flash = ColorRect.new()
	_anim_flash.color = Color(1, 1, 1, 0)
	_anim_flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	_anim_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anim_root.add_child(_anim_flash)

	_anim_onoma = Label.new()
	_anim_onoma.text = "カチッ"
	_anim_onoma.add_theme_font_size_override("font_size", 128)
	_anim_onoma.add_theme_color_override("font_color", Color(1, 1, 1))
	_anim_onoma.add_theme_color_override("font_outline_color", Color(0.08, 0.4, 0.7))
	_anim_onoma.add_theme_constant_override("outline_size", 14)
	_anim_onoma.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_anim_onoma.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anim_root.add_child(_anim_onoma)


func open_swap(on_closed: Callable = Callable()) -> void:
	## Build the case grid from currently owned cases, then show.
	## Persistent node (lives in main.tscn) — reset transient state each
	## time so a prior animation/run doesn't leave it half-open.
	_on_closed = on_closed
	_animating = false
	if _anim_root:
		_anim_root.visible = false
	if _picker_panel:
		_picker_panel.visible = true
	_rebuild_grid()
	visible = true


func close_swap() -> void:
	## Hide (do NOT free — this is a persistent main.tscn node).
	if _animating:
		return
	visible = false
	var cb := _on_closed
	_on_closed = Callable()
	if cb.is_valid():
		cb.call()


func _on_backdrop_input(event: InputEvent) -> void:
	if _animating:
		return
	if event is InputEventMouseButton and event.pressed:
		close_swap()


func _rebuild_grid() -> void:
	for c in _grid.get_children():
		c.queue_free()

	for case_id in GameManager.owned_phone_cases:
		var data: Dictionary = GameManager.phone_case_data(case_id)
		var is_equipped: bool = case_id == GameManager.equipped_phone_case

		var card := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.93, 0.89, 0.78) if not is_equipped else Color(0.99, 0.93, 0.62)
		sb.border_color = Color(0.55, 0.45, 0.30) if not is_equipped else Color(0.78, 0.55, 0.10)
		sb.border_width_left = 2
		sb.border_width_top = 2
		sb.border_width_right = 2
		sb.border_width_bottom = 2
		sb.corner_radius_top_left = 8
		sb.corner_radius_top_right = 8
		sb.corner_radius_bottom_right = 8
		sb.corner_radius_bottom_left = 8
		sb.content_margin_left = 10
		sb.content_margin_right = 10
		sb.content_margin_top = 10
		sb.content_margin_bottom = 10
		card.add_theme_stylebox_override("panel", sb)
		card.custom_minimum_size = Vector2(130, 130)

		var card_v := VBoxContainer.new()
		card_v.alignment = BoxContainer.ALIGNMENT_CENTER
		card_v.add_theme_constant_override("separation", 4)
		card.add_child(card_v)

		var small_path := str(data.get("small_path", ""))
		if small_path != "" and ResourceLoader.exists(small_path):
			var tex := load(small_path) as Texture2D
			if tex:
				var rect := TextureRect.new()
				rect.texture = tex
				rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				rect.custom_minimum_size = Vector2(72, 72)
				card_v.add_child(rect)

		var name_lbl := Label.new()
		name_lbl.text = str(data.get("name_jp", ""))
		name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_lbl.add_theme_font_size_override("font_size", 14)
		name_lbl.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
		card_v.add_child(name_lbl)

		# English subtitle so the plain-phone option ("No Case") is
		# unmistakable even when the tiny icon is hard to read.
		var en_lbl := Label.new()
		en_lbl.text = str(data.get("name_en", ""))
		en_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		en_lbl.add_theme_font_size_override("font_size", 10)
		en_lbl.add_theme_color_override("font_color", Color(0.45, 0.38, 0.28))
		card_v.add_child(en_lbl)

		if is_equipped:
			var equipped_lbl := Label.new()
			equipped_lbl.text = "そうび ちゅう"
			equipped_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			equipped_lbl.add_theme_font_size_override("font_size", 11)
			equipped_lbl.add_theme_color_override("font_color", Color(0.45, 0.32, 0.05))
			card_v.add_child(equipped_lbl)

		var btn := Button.new()
		btn.flat = true
		btn.custom_minimum_size = Vector2(130, 130)
		btn.set_anchors_preset(Control.PRESET_FULL_RECT)
		btn.pressed.connect(_on_case_picked.bind(case_id))
		card.add_child(btn)

		_grid.add_child(card)


func _on_case_picked(case_id: String) -> void:
	if _animating:
		return
	# Re-picking the already-equipped case is a no-op — just close.
	if case_id == GameManager.equipped_phone_case:
		close_swap()
		return

	# Resolve the picked case's large sprite for the animation.
	var data: Dictionary = GameManager.phone_case_data(case_id)
	var large_path := str(data.get("large_path", ""))
	var tex: Texture2D = null
	if large_path != "" and ResourceLoader.exists(large_path):
		tex = load(large_path) as Texture2D

	_play_swap_anim(case_id, tex)


func _play_swap_anim(case_id: String, tex: Texture2D) -> void:
	_animating = true
	# Hide the picker, show the animation root.
	_picker_panel.visible = false
	_anim_root.visible = true

	# Phone sprite: centered, ~45% of viewport height.
	var vp := get_viewport().get_visible_rect().size
	var sprite_h := vp.y * 0.45
	var sprite_w := sprite_h
	_anim_phone.texture = tex
	_anim_phone.size = Vector2(sprite_w, sprite_h)
	_anim_phone.position = Vector2(vp.x * 0.5 - sprite_w * 0.5, vp.y * 0.5 - sprite_h * 0.5)
	_anim_phone.pivot_offset = Vector2(sprite_w * 0.5, sprite_h * 0.5)
	_anim_phone.scale = Vector2(0.55, 0.55)
	_anim_phone.modulate.a = 0.0

	# Onomatopoeia label centered above the phone.
	_anim_onoma.size = Vector2(800, 200)
	_anim_onoma.position = Vector2(vp.x * 0.5 - 400, vp.y * 0.5 - sprite_h * 0.5 - 200)
	_anim_onoma.pivot_offset = Vector2(_anim_onoma.size.x * 0.5, _anim_onoma.size.y * 0.5)
	_anim_onoma.scale = Vector2(0.5, 0.5)
	_anim_onoma.modulate.a = 0.0

	_anim_flash.color.a = 0.0

	# Tween sequence: punch in, hold, fade out.
	var t := create_tween()

	# 1. Phone scales up + fades in (~0.25s), カチッ pops + flash punches at
	#    the same beat.
	t.set_parallel(true)
	t.tween_property(_anim_phone, "scale", Vector2(1.0, 1.0), 0.28)\
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(_anim_phone, "modulate:a", 1.0, 0.2)
	t.tween_property(_anim_onoma, "scale", Vector2(1.0, 1.0), 0.32)\
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(_anim_onoma, "modulate:a", 1.0, 0.2)
	t.tween_property(_anim_flash, "color:a", 0.7, 0.05)
	t.set_parallel(false)
	t.tween_property(_anim_flash, "color:a", 0.0, 0.25)\
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

	# 2. Hold beat.
	t.tween_interval(0.35)

	# 3. Fade everything out.
	t.set_parallel(true)
	t.tween_property(_anim_phone, "modulate:a", 0.0, 0.35)
	t.tween_property(_anim_onoma, "modulate:a", 0.0, 0.35)
	t.set_parallel(false)

	# 4. Equip + close.
	t.tween_callback(func():
		GameManager.equip_phone_case(case_id)
		_animating = false
		close_swap()
	)
