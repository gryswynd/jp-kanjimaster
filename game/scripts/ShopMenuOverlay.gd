extends CanvasLayer
## Shop menu — konbini / vending purchase UI.
##
## Modes:
##   - WINDOW-SHOPPING (no `on_checkout` set): item cards display only.
##     Used Days 5-7 before 買う lands. Tap a card and nothing happens.
##   - BUYABLE (`on_checkout` set): each card gets a − / + quantity
##     stepper, the panel shows a live 合計 (total) + 残高 (balance), and
##     a 会計 (checkout) button. Total turns red and the checkout button
##     greys out when the cart exceeds the player's balance OR the cart
##     is empty. Used Day 8+.
##
## Caller wires:
##   shop_menu_overlay.on_checkout = func(cart: Dictionary):
##     # cart: { item_id -> quantity } for items with quantity > 0
##     # The caller plays the tap-to-pay animation, spends the yen, adds
##     # the items to inventory, and runs the shopkeeper closing line.
##     ...
##   shop_menu_overlay.open_menu(items)
##
## items: Array of { id, jp, en, price (int), sprite (path) }

var items: Array = []
var cart: Dictionary = {}  # item_id -> quantity (>0)
var on_checkout: Callable = Callable()

var _backdrop: ColorRect
var _panel: PanelContainer
var _grid: GridContainer
var _total_label: Label
var _balance_label: Label
var _checkout_btn: Button
var _footer: VBoxContainer

# Per-item-id refs so +/- can update the same card without rebuilding.
var _qty_labels: Dictionary = {}  # item_id -> Label


func _ready() -> void:
	layer = 18  # above PhoneOverlay (13), Conversation (17)
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
	_panel.custom_minimum_size = Vector2(620, 480)
	_panel.size = Vector2(620, 480)
	_panel.position = Vector2(-310, -240)

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
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	margin.add_child(vbox)

	var title := Label.new()
	title.text = "メニュー / Menu"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	vbox.add_child(title)

	var rule := HSeparator.new()
	vbox.add_child(rule)

	_grid = GridContainer.new()
	_grid.columns = 3
	_grid.add_theme_constant_override("h_separation", 16)
	_grid.add_theme_constant_override("v_separation", 12)
	vbox.add_child(_grid)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(spacer)

	# Footer holds the totals row + the action-button row. Built/rebuilt
	# in _refresh() so the buyable / display-only modes differ cleanly.
	_footer = VBoxContainer.new()
	_footer.add_theme_constant_override("separation", 10)
	vbox.add_child(_footer)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_menu()


func open_menu(item_list: Array) -> void:
	items = item_list
	cart = {}
	_refresh()
	visible = true


func close_menu() -> void:
	visible = false
	cart = {}
	on_checkout = Callable()


# --- Internal: rebuild grid + footer based on current mode + cart. ---

func _refresh() -> void:
	for c in _grid.get_children():
		c.queue_free()
	_qty_labels.clear()
	var buyable := on_checkout.is_valid()
	for it in items:
		_grid.add_child(_make_item_card(it, buyable))

	# Footer rebuild — display-only mode just gets a close button;
	# buyable mode gets totals + checkout + close.
	for c in _footer.get_children():
		c.queue_free()
	if buyable:
		_build_buyable_footer()
	else:
		_build_display_footer()


func _build_display_footer() -> void:
	## Window-shopping (Days 5-7) — single close button, no totals.
	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 14)
	close.custom_minimum_size = Vector2(120, 32)
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_menu)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(close)
	_footer.add_child(row)


func _build_buyable_footer() -> void:
	## Day 8+ buying mode — live 合計 + 残高, then checkout + close.
	var totals_row := HBoxContainer.new()
	totals_row.add_theme_constant_override("separation", 24)
	totals_row.alignment = BoxContainer.ALIGNMENT_CENTER

	_total_label = Label.new()
	_total_label.add_theme_font_size_override("font_size", 18)
	_total_label.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	totals_row.add_child(_total_label)

	_balance_label = Label.new()
	_balance_label.add_theme_font_size_override("font_size", 18)
	_balance_label.add_theme_color_override("font_color", Color(0.35, 0.27, 0.18))
	totals_row.add_child(_balance_label)

	_footer.add_child(totals_row)

	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 18)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 14)
	close.custom_minimum_size = Vector2(110, 36)
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_menu)
	actions.add_child(close)

	_checkout_btn = Button.new()
	_checkout_btn.text = "会計 / Checkout"
	_checkout_btn.add_theme_font_size_override("font_size", 14)
	_checkout_btn.custom_minimum_size = Vector2(170, 36)
	_checkout_btn.focus_mode = Control.FOCUS_NONE
	_checkout_btn.pressed.connect(_on_checkout_pressed)
	actions.add_child(_checkout_btn)

	_footer.add_child(actions)
	_update_totals()


func _make_item_card(item: Dictionary, buyable: bool) -> Control:
	var card := PanelContainer.new()
	var card_sb := StyleBoxFlat.new()
	card_sb.bg_color = Color(0.93, 0.89, 0.78)
	card_sb.border_color = Color(0.55, 0.45, 0.30)
	card_sb.border_width_left = 1
	card_sb.border_width_top = 1
	card_sb.border_width_right = 1
	card_sb.border_width_bottom = 1
	card_sb.corner_radius_top_left = 8
	card_sb.corner_radius_top_right = 8
	card_sb.corner_radius_bottom_right = 8
	card_sb.corner_radius_bottom_left = 8
	card_sb.content_margin_left = 10
	card_sb.content_margin_right = 10
	card_sb.content_margin_top = 10
	card_sb.content_margin_bottom = 10
	card.add_theme_stylebox_override("panel", card_sb)
	var card_h := 200 if buyable else 156
	card.custom_minimum_size = Vector2(150, card_h)

	var cv := VBoxContainer.new()
	cv.alignment = BoxContainer.ALIGNMENT_CENTER
	cv.add_theme_constant_override("separation", 6)
	card.add_child(cv)

	var sprite_path: String = str(item.get("sprite", ""))
	if sprite_path != "" and ResourceLoader.exists(sprite_path):
		var tex := load(sprite_path) as Texture2D
		if tex:
			var rect := TextureRect.new()
			rect.texture = tex
			rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			rect.custom_minimum_size = Vector2(80, 80)
			rect.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			cv.add_child(rect)

	var name_lbl := Label.new()
	name_lbl.text = str(item.get("jp", ""))
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_size_override("font_size", 14)
	name_lbl.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	cv.add_child(name_lbl)

	var price_lbl := Label.new()
	price_lbl.text = "%d円" % int(item.get("price", 0))
	price_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	price_lbl.add_theme_font_size_override("font_size", 16)
	price_lbl.add_theme_color_override("font_color", Color(0.35, 0.22, 0.05))
	cv.add_child(price_lbl)

	if buyable:
		# Stepper row: [-] qty [+]. The qty label is captured in
		# _qty_labels so totals updates re-paint just this card.
		var item_id := str(item.get("id", ""))
		var stepper := HBoxContainer.new()
		stepper.alignment = BoxContainer.ALIGNMENT_CENTER
		stepper.add_theme_constant_override("separation", 8)

		var minus := Button.new()
		minus.text = "−"
		minus.add_theme_font_size_override("font_size", 18)
		minus.custom_minimum_size = Vector2(36, 32)
		minus.focus_mode = Control.FOCUS_NONE
		minus.pressed.connect(func(): _adjust(item_id, -1))
		stepper.add_child(minus)

		var qty := Label.new()
		qty.text = "0"
		qty.add_theme_font_size_override("font_size", 18)
		qty.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
		qty.custom_minimum_size = Vector2(28, 0)
		qty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stepper.add_child(qty)
		_qty_labels[item_id] = qty

		var plus := Button.new()
		plus.text = "+"
		plus.add_theme_font_size_override("font_size", 18)
		plus.custom_minimum_size = Vector2(36, 32)
		plus.focus_mode = Control.FOCUS_NONE
		plus.pressed.connect(func(): _adjust(item_id, 1))
		stepper.add_child(plus)

		cv.add_child(stepper)

	return card


# --- Cart adjustments + total recompute. ---

func _adjust(item_id: String, delta: int) -> void:
	var current := int(cart.get(item_id, 0))
	var next: int = max(0, current + delta)
	# Optional per-item cap (e.g. unique items like a phone case: "max": 1).
	for it in items:
		if str(it.get("id", "")) == item_id and it.has("max"):
			next = min(next, int(it["max"]))
			break
	if next == 0:
		cart.erase(item_id)
	else:
		cart[item_id] = next
	if _qty_labels.has(item_id):
		(_qty_labels[item_id] as Label).text = str(next)
	_update_totals()


func _cart_total() -> int:
	var total := 0
	for it in items:
		var qty := int(cart.get(str(it.get("id", "")), 0))
		total += qty * int(it.get("price", 0))
	return total


func _update_totals() -> void:
	if _total_label == null or _balance_label == null:
		return
	var total := _cart_total()
	var balance := int(GameManager.yen)
	_total_label.text = "合計 ¥%d" % total
	_balance_label.text = "残高 ¥%d" % balance
	# Total turns red when the cart exceeds the player's balance, so the
	# player sees the limit visually before they hit checkout.
	if total > balance:
		_total_label.add_theme_color_override("font_color", Color(0.85, 0.15, 0.15))
	else:
		_total_label.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	# Checkout disabled when over balance OR cart empty.
	if _checkout_btn:
		_checkout_btn.disabled = (total > balance) or (total == 0)


func _on_checkout_pressed() -> void:
	## Snapshot the cart, hand it to the caller, close the menu. The
	## caller is responsible for the tap-to-pay cinematic, deducting yen,
	## and adding the purchased items to inventory.
	if not on_checkout.is_valid():
		return
	var snapshot := cart.duplicate(true)
	var cb := on_checkout
	visible = false
	cart = {}
	on_checkout = Callable()
	cb.call(snapshot)
