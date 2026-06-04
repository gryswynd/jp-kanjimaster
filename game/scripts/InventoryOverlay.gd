extends CanvasLayer
## Inventory overlay — grid of held items with sprite + name +
## description. Opens via the I key (or a future HUD button).
## Re-renders on GameManager.inventory_changed.
##
## Special item: the phone shows up at the top of the grid when
## GameManager.has_phone is true. Tapping it shows a ケースをかえる /
## Swap Case action that opens PhoneCaseSwapOverlay (instantiated
## lazily so it doesn't need a node in main.tscn).

const _PHONE_ITEM_ID := "_phone"

var _backdrop: ColorRect
var _panel: PanelContainer
var _grid: GridContainer
var _empty_label: Label
var _detail_label: RichTextLabel
var _action_row: HBoxContainer

# Set by DayLoader — runs when the player taps the water "drink" button.
var on_use_water: Callable = Callable()

# Set by DayLoader — runs when the player taps the onigiri "eat" button.
var on_use_onigiri: Callable = Callable()

# Set by DayLoader — runs when the player taps the soda "drink" button.
var on_use_soda: Callable = Callable()

# Set by DayLoader — runs when the player taps the curry "eat" button.
var on_use_curry: Callable = Callable()


func _ready() -> void:
	layer = 14
	visible = false
	_build_ui()
	GameManager.inventory_changed.connect(_refresh)


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
	title.text = "もちもの / Inventory"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(title)

	var divider := HSeparator.new()
	vbox.add_child(divider)

	_grid = GridContainer.new()
	_grid.columns = 6
	_grid.add_theme_constant_override("h_separation", 14)
	_grid.add_theme_constant_override("v_separation", 14)
	vbox.add_child(_grid)

	_empty_label = Label.new()
	_empty_label.text = "なにも ありません。 / No items yet."
	_empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty_label.add_theme_color_override("font_color", Color(0.4, 0.32, 0.22))
	_empty_label.add_theme_font_size_override("font_size", 16)
	vbox.add_child(_empty_label)

	_detail_label = RichTextLabel.new()
	_detail_label.bbcode_enabled = true
	_detail_label.fit_content = true
	_detail_label.scroll_active = false
	_detail_label.add_theme_font_size_override("normal_font_size", 16)
	_detail_label.add_theme_color_override("default_color", Color(0.15, 0.10, 0.05))
	_detail_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(_detail_label)

	# Action buttons (e.g. 飲む for the water bottle) appear here when the
	# selected item has an available action.
	_action_row = HBoxContainer.new()
	_action_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_action_row.add_theme_constant_override("separation", 12)
	vbox.add_child(_action_row)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 16)
	close.custom_minimum_size = Vector2(140, 36)
	close.pressed.connect(close_inventory)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	vbox.add_child(close_row)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_inventory()


func open_inventory() -> void:
	_refresh()
	visible = true


func close_inventory() -> void:
	visible = false


func _refresh() -> void:
	for c in _grid.get_children():
		c.queue_free()

	# The grid has a phone-tile (if the player has the phone) plus the
	# regular inventory items. Show empty state only if BOTH are absent.
	var phone_present := GameManager.has_phone
	if not phone_present and GameManager.inventory.is_empty():
		_empty_label.visible = true
		_grid.visible = false
		_detail_label.clear()
		return

	_empty_label.visible = false
	_grid.visible = true

	# Synthetic phone item — first slot in the grid. Icon swaps with the
	# equipped case so the player can see what they're currently carrying.
	if phone_present:
		var phone_item := _make_phone_item()
		_add_grid_card(phone_item)

	for item in GameManager.inventory:
		_add_grid_card(item)

	# Default detail: phone first if present, else first inventory item.
	if phone_present:
		_show_detail(_make_phone_item())
	elif not GameManager.inventory.is_empty():
		_show_detail(GameManager.inventory[0])


func _add_grid_card(item: Dictionary) -> void:
	var card := PanelContainer.new()
	var card_sb := StyleBoxFlat.new()
	card_sb.bg_color = Color(0.93, 0.89, 0.78)
	card_sb.border_color = Color(0.55, 0.45, 0.30)
	card_sb.border_width_left = 1
	card_sb.border_width_top = 1
	card_sb.border_width_right = 1
	card_sb.border_width_bottom = 1
	card_sb.corner_radius_top_left = 6
	card_sb.corner_radius_top_right = 6
	card_sb.corner_radius_bottom_right = 6
	card_sb.corner_radius_bottom_left = 6
	card_sb.content_margin_left = 8
	card_sb.content_margin_right = 8
	card_sb.content_margin_top = 8
	card_sb.content_margin_bottom = 8
	card.add_theme_stylebox_override("panel", card_sb)
	card.custom_minimum_size = Vector2(92, 110)

	var card_v := VBoxContainer.new()
	card_v.alignment = BoxContainer.ALIGNMENT_CENTER
	card_v.add_theme_constant_override("separation", 4)
	card.add_child(card_v)

	var sprite_path := str(item.get("sprite", ""))
	if sprite_path != "" and ResourceLoader.exists(sprite_path):
		var tex := load(sprite_path) as Texture2D
		if tex:
			var rect := TextureRect.new()
			rect.texture = tex
			rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			rect.custom_minimum_size = Vector2(64, 64)
			card_v.add_child(rect)

	var name_jp := Label.new()
	name_jp.text = str(item.get("nameJp", ""))
	name_jp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_jp.add_theme_font_size_override("font_size", 14)
	name_jp.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	card_v.add_child(name_jp)

	var btn := Button.new()
	btn.flat = true
	btn.custom_minimum_size = Vector2(92, 110)
	btn.set_anchors_preset(Control.PRESET_FULL_RECT)
	btn.pressed.connect(_on_item_selected.bind(item))
	card.add_child(btn)

	_grid.add_child(card)


func _make_phone_item() -> Dictionary:
	## Synthetic inventory entry representing the phone. The sprite path is
	## resolved per-render against the equipped phone case, so swapping a
	## case re-icons this tile on next _refresh.
	var case_data: Dictionary = GameManager.phone_case_data()
	return {
		"id": _PHONE_ITEM_ID,
		"nameJp": "スマホ",
		"nameEn": "Phone",
		"sprite": str(case_data.get("small_path", "")),
		"description": "[i]ケース:[/i] %s" % str(case_data.get("name_jp", "")),
	}


func _on_item_selected(item: Dictionary) -> void:
	_show_detail(item)


func _show_detail(item: Dictionary) -> void:
	var lines := []
	lines.append("[b]%s[/b]" % str(item.get("nameJp", "")))
	lines.append("[color=#7a6855]%s[/color]" % str(item.get("nameEn", "")))
	var desc := str(item.get("description", ""))
	if desc != "":
		lines.append("")
		lines.append(desc)
	_detail_label.clear()
	_detail_label.append_text("\n".join(lines))

	# Rebuild action buttons for the selected item.
	for c in _action_row.get_children():
		c.queue_free()
	# Phone: 「ケースをかえる」 opens PhoneCaseSwapOverlay.
	if str(item.get("id", "")) == _PHONE_ITEM_ID:
		var swap_btn := Button.new()
		swap_btn.text = "ケースをかえる / Swap Case"
		swap_btn.add_theme_font_size_override("font_size", 16)
		swap_btn.custom_minimum_size = Vector2(220, 38)
		swap_btn.pressed.connect(_open_case_swap)
		_action_row.add_child(swap_btn)
	# Water bottle: 飲む (drink) becomes available once the drink_water
	# quest's verb has been filled in (Day 7+, when 飲む is taught).
	if str(item.get("id", "")) == "water_bottle" and _verb_unlocked("drink_water"):
		var drink := Button.new()
		drink.text = "飲む / Drink"
		drink.add_theme_font_size_override("font_size", 16)
		drink.custom_minimum_size = Vector2(160, 38)
		drink.pressed.connect(func():
			if on_use_water.is_valid():
				on_use_water.call()
		)
		_action_row.add_child(drink)
	# Soda: 飲む (drink) gated on the same 飲む verb as water (drink_water).
	# No quest of its own — drinking just plays the CG and consumes a can.
	if str(item.get("id", "")) == "soda" and _verb_unlocked("drink_water"):
		var drink_soda := Button.new()
		drink_soda.text = "飲む / Drink"
		drink_soda.add_theme_font_size_override("font_size", 16)
		drink_soda.custom_minimum_size = Vector2(160, 38)
		drink_soda.pressed.connect(func():
			if on_use_soda.is_valid():
				on_use_soda.call()
		)
		_action_row.add_child(drink_soda)
	# Onigiri: 食べる (eat) becomes available once the onigiri_quest's
	# verb has been filled in (Day 7+, when 食べる is taught). Eating
	# from inventory both resolves the quest (first time only) and
	# consumes one onigiri from the stack.
	if str(item.get("id", "")) == "onigiri" and _verb_unlocked("onigiri_quest"):
		var eat := Button.new()
		eat.text = "食べる / Eat"
		eat.add_theme_font_size_override("font_size", 16)
		eat.custom_minimum_size = Vector2(160, 38)
		eat.pressed.connect(func():
			if on_use_onigiri.is_valid():
				on_use_onigiri.call()
		)
		_action_row.add_child(eat)
	# Curry: 食べる (eat) — bought at the riverside stand (Day 8+). Same
	# 食べる gate as onigiri; eating plays the curry CG and consumes a plate.
	if str(item.get("id", "")) == "curry" and _verb_unlocked("onigiri_quest"):
		var eat_curry := Button.new()
		eat_curry.text = "食べる / Eat"
		eat_curry.add_theme_font_size_override("font_size", 16)
		eat_curry.custom_minimum_size = Vector2(160, 38)
		eat_curry.pressed.connect(func():
			if on_use_curry.is_valid():
				on_use_curry.call()
		)
		_action_row.add_child(eat_curry)


func _open_case_swap() -> void:
	## Open the persistent PhoneCaseSwapOverlay (sibling node in main.tscn).
	## On close, refresh so the new equipped case's sprite shows up.
	var swap := get_node_or_null("../PhoneCaseSwapOverlay")
	if swap == null:
		push_warning("PhoneCaseSwapOverlay node not found in scene.")
		return
	swap.open_swap(func(): _refresh())


func _verb_unlocked(quest_id: String) -> bool:
	## Has the verb on `quest_id` been filled in yet? Used to gate the
	## eat / drink action buttons until the corresponding lesson lands.
	for q in GameManager.quests:
		if q.get("id") == quest_id:
			var v = q.get("verb")
			return v != null and str(v) != ""
	return false


func _drink_unlocked() -> bool:
	## Kept for backwards compat; prefer _verb_unlocked("drink_water").
	return _verb_unlocked("drink_water")
