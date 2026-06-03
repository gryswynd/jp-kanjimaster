extends CanvasLayer
## Phone Wallet app — banking-style screen with a big balance, a tap-to-pay
## affordance, and a transactions list. All future purchases will route
## through this overlay (tap-to-pay deducts and logs the transaction).

var _backdrop: ColorRect
var _panel: PanelContainer
var _balance_label: Label
var _history_list: VBoxContainer
var _history_empty_label: Label

# Per-session transaction log. Persists in GameManager.wallet_history so
# it survives reloads (set up below when GameManager exposes the field).
var _local_history: Array = []  # fallback if GM doesn't expose history yet


func _ready() -> void:
	layer = 15  # above PhoneOverlay (13) so it sits on top when opened from it
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

	# Phone-shaped panel — same bezel proportions as PhoneOverlay so the
	# wallet feels like a single app within the phone OS.
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

	# Inner "screen" wallpaper — warm cream so the wallet reads as a
	# distinct app inside the otherwise-sage phone OS.
	var screen := PanelContainer.new()
	var wallpaper := StyleBoxFlat.new()
	wallpaper.bg_color = Color(0.98, 0.95, 0.86)
	wallpaper.corner_radius_top_left = 18
	wallpaper.corner_radius_top_right = 18
	wallpaper.corner_radius_bottom_right = 18
	wallpaper.corner_radius_bottom_left = 18
	wallpaper.content_margin_left = 16
	wallpaper.content_margin_right = 16
	wallpaper.content_margin_top = 18
	wallpaper.content_margin_bottom = 16
	screen.add_theme_stylebox_override("panel", wallpaper)
	_panel.add_child(screen)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	screen.add_child(v)

	var title := Label.new()
	title.text = "ウォレット / Wallet"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color(0.30, 0.22, 0.10))
	v.add_child(title)

	# Big balance card — golden tile, prominent number.
	var balance_card := PanelContainer.new()
	var bc_sb := StyleBoxFlat.new()
	bc_sb.bg_color = Color(0.95, 0.82, 0.40)
	bc_sb.border_color = Color(0.55, 0.40, 0.10)
	bc_sb.border_width_left = 2
	bc_sb.border_width_top = 2
	bc_sb.border_width_right = 2
	bc_sb.border_width_bottom = 2
	bc_sb.corner_radius_top_left = 14
	bc_sb.corner_radius_top_right = 14
	bc_sb.corner_radius_bottom_right = 14
	bc_sb.corner_radius_bottom_left = 14
	bc_sb.content_margin_left = 14
	bc_sb.content_margin_right = 14
	bc_sb.content_margin_top = 14
	bc_sb.content_margin_bottom = 14
	balance_card.add_theme_stylebox_override("panel", bc_sb)

	var bc_v := VBoxContainer.new()
	bc_v.add_theme_constant_override("separation", 2)
	balance_card.add_child(bc_v)

	var bc_label := Label.new()
	bc_label.text = "ざんだか / Balance"
	bc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bc_label.add_theme_font_size_override("font_size", 12)
	bc_label.add_theme_color_override("font_color", Color(0.35, 0.22, 0.05))
	bc_v.add_child(bc_label)

	_balance_label = Label.new()
	_balance_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_balance_label.add_theme_font_size_override("font_size", 32)
	_balance_label.add_theme_color_override("font_color", Color(0.20, 0.12, 0.02))
	bc_v.add_child(_balance_label)

	var tap_hint := Label.new()
	tap_hint.text = "タップで支払い / Tap to pay"
	tap_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tap_hint.add_theme_font_size_override("font_size", 11)
	tap_hint.add_theme_color_override("font_color", Color(0.35, 0.22, 0.05))
	bc_v.add_child(tap_hint)

	v.add_child(balance_card)

	# Transactions header + list.
	var history_title := Label.new()
	history_title.text = "りれき / History"
	history_title.add_theme_font_size_override("font_size", 14)
	history_title.add_theme_color_override("font_color", Color(0.30, 0.22, 0.10))
	v.add_child(history_title)

	var rule := ColorRect.new()
	rule.color = Color(0.30, 0.22, 0.10, 0.35)
	rule.custom_minimum_size = Vector2(0, 1)
	v.add_child(rule)

	_history_list = VBoxContainer.new()
	_history_list.add_theme_constant_override("separation", 4)
	_history_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(_history_list)

	_history_empty_label = Label.new()
	_history_empty_label.text = "まだ取引はありません。\nNo transactions yet."
	_history_empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_history_empty_label.add_theme_font_size_override("font_size", 12)
	_history_empty_label.add_theme_color_override("font_color", Color(0.55, 0.45, 0.30))
	_history_list.add_child(_history_empty_label)

	var close := Button.new()
	close.text = "とじる"
	close.add_theme_font_size_override("font_size", 13)
	close.custom_minimum_size = Vector2(110, 30)
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_wallet)
	var close_row := HBoxContainer.new()
	close_row.alignment = BoxContainer.ALIGNMENT_CENTER
	close_row.add_child(close)
	v.add_child(close_row)

	add_child(_panel)


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_wallet()


func open_wallet() -> void:
	_refresh()
	visible = true


func close_wallet() -> void:
	visible = false


func _refresh() -> void:
	_balance_label.text = "¥%d" % GameManager.yen

	var history: Array = _get_history()
	# Wipe rendered rows (keep _history_empty_label as a flag-holder).
	for c in _history_list.get_children():
		if c == _history_empty_label:
			continue
		c.queue_free()

	if history.is_empty():
		_history_empty_label.visible = true
		return

	_history_empty_label.visible = false
	# Newest first.
	for entry in history:
		_history_list.add_child(_make_history_row(entry))


func _get_history() -> Array:
	## Read from GameManager if it exposes wallet_history, otherwise fall
	## back to the local cache. Lets WalletOverlay ship before the GM-side
	## persistence wiring lands.
	if "wallet_history" in GameManager:
		return GameManager.wallet_history
	return _local_history


func _make_history_row(entry: Dictionary) -> Control:
	## A single transaction row — date, label, signed amount.
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)

	var date_lbl := Label.new()
	date_lbl.text = str(entry.get("date", ""))
	date_lbl.add_theme_font_size_override("font_size", 11)
	date_lbl.add_theme_color_override("font_color", Color(0.55, 0.45, 0.30))
	date_lbl.custom_minimum_size = Vector2(60, 0)
	row.add_child(date_lbl)

	var label_lbl := Label.new()
	label_lbl.text = str(entry.get("label", ""))
	label_lbl.add_theme_font_size_override("font_size", 12)
	label_lbl.add_theme_color_override("font_color", Color(0.20, 0.12, 0.02))
	label_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label_lbl)

	var amount: int = int(entry.get("amount", 0))
	var amount_lbl := Label.new()
	amount_lbl.text = ("+¥%d" % amount) if amount >= 0 else ("-¥%d" % -amount)
	amount_lbl.add_theme_font_size_override("font_size", 12)
	if amount >= 0:
		amount_lbl.add_theme_color_override("font_color", Color(0.20, 0.50, 0.20))
	else:
		amount_lbl.add_theme_color_override("font_color", Color(0.60, 0.20, 0.20))
	row.add_child(amount_lbl)
	return row
