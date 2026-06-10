extends CanvasLayer
## Smartphone overlay — Day 4+. Modelled as a phone OS homescreen: status
## bar at the top, a wallpaper backing, and a grid of app icons below.
## Active apps (Wallet, Items, Quests) launch the existing inventory and
## quest overlays. Greyed-out placeholder apps are visible but disabled —
## they'll light up as later N5 lessons unlock new features.

@export var on_open_inventory: Callable
@export var on_open_quests: Callable
@export var on_open_wallet: Callable
@export var on_open_messages: Callable
@export var on_open_contacts: Callable

var _backdrop: ColorRect
var _panel: PanelContainer
var _time_label: Label
var _app_grid: GridContainer
var _panel_home_pos: Vector2  # remembered for vibrate-then-restore
var _vibrate_tween: Tween
var _wallet_box: Control      # ¥ tile, flashed on payday
var _items_box: Control       # 持 もちもの tile, flashed when an item is received
var _messages_box: Control    # ✉ tile, highlighted when new messages arrive
var _contacts_box: Control     # 連 tile, pulsed when a new contact memo is earned
var _sfx: AudioStreamPlayer   # coin + ringtone for the payday sequence


func _ready() -> void:
	layer = 13
	visible = false
	_build_ui()
	_panel_home_pos = _panel.position
	_sfx = AudioStreamPlayer.new()
	add_child(_sfx)
	GameManager.inventory_changed.connect(_refresh)
	GameManager.quest_changed.connect(_refresh)
	GameManager.messages_changed.connect(_refresh)


func _build_ui() -> void:
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.55)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.gui_input.connect(_on_backdrop_input)
	add_child(_backdrop)

	# Phone bezel — dark slate panel with rounded corners, portrait.
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

	# Inner "screen" wallpaper — pastel sage so it ties to the case art.
	var screen := PanelContainer.new()
	var wallpaper := StyleBoxFlat.new()
	wallpaper.bg_color = Color(0.72, 0.83, 0.71)  # pale sage
	wallpaper.corner_radius_top_left = 18
	wallpaper.corner_radius_top_right = 18
	wallpaper.corner_radius_bottom_right = 18
	wallpaper.corner_radius_bottom_left = 18
	wallpaper.content_margin_left = 14
	wallpaper.content_margin_right = 14
	wallpaper.content_margin_top = 14
	wallpaper.content_margin_bottom = 14
	screen.add_theme_stylebox_override("panel", wallpaper)
	_panel.add_child(screen)

	var screen_v := VBoxContainer.new()
	screen_v.add_theme_constant_override("separation", 10)
	screen.add_child(screen_v)

	# Status bar — time + a small battery glyph, OS-style.
	var status_bar := HBoxContainer.new()
	status_bar.add_theme_constant_override("separation", 6)
	screen_v.add_child(status_bar)

	_time_label = Label.new()
	_time_label.add_theme_font_size_override("font_size", 18)
	_time_label.add_theme_color_override("font_color", Color(0.12, 0.18, 0.10))
	_time_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_bar.add_child(_time_label)

	var battery := Label.new()
	battery.text = "▮▮▮▯"
	battery.add_theme_font_size_override("font_size", 14)
	battery.add_theme_color_override("font_color", Color(0.18, 0.30, 0.16))
	status_bar.add_child(battery)

	# Subtle divider under the status bar.
	var rule := ColorRect.new()
	rule.color = Color(0.18, 0.30, 0.16, 0.25)
	rule.custom_minimum_size = Vector2(0, 1)
	screen_v.add_child(rule)

	# App grid — 3 columns. Active apps first, placeholders fill the rest
	# so the homescreen looks like an actual phone with future capacity.
	_app_grid = GridContainer.new()
	_app_grid.columns = 3
	_app_grid.add_theme_constant_override("h_separation", 10)
	_app_grid.add_theme_constant_override("v_separation", 12)
	_app_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_app_grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	screen_v.add_child(_app_grid)

	# Bottom: home-bar only — yen now lives inside the Wallet app.
	var home_bar := ColorRect.new()
	home_bar.color = Color(0.18, 0.30, 0.16, 0.4)
	home_bar.custom_minimum_size = Vector2(90, 3)
	var home_wrap := CenterContainer.new()
	home_wrap.add_child(home_bar)
	screen_v.add_child(home_wrap)

	add_child(_panel)


func _make_app_tile(symbol: String, jp_label: String, color: Color, on_press: Callable) -> Control:
	## A single phone-OS app tile: rounded colored square with a kanji/symbol
	## centered, label underneath. Disabled tiles are dimmed but still drawn.
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	box.custom_minimum_size = Vector2(82, 78)

	var tile := Button.new()
	tile.text = symbol
	tile.custom_minimum_size = Vector2(60, 60)
	tile.add_theme_font_size_override("font_size", 28)
	tile.add_theme_color_override("font_color", Color(0.98, 0.98, 0.95))
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.border_color = Color(0, 0, 0, 0.25)
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.corner_radius_top_left = 14
	sb.corner_radius_top_right = 14
	sb.corner_radius_bottom_right = 14
	sb.corner_radius_bottom_left = 14
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 3
	sb.shadow_offset = Vector2(0, 2)
	tile.add_theme_stylebox_override("normal", sb)
	var sb_hover := sb.duplicate()
	sb_hover.bg_color = color.lerp(Color(1, 1, 1), 0.15)
	tile.add_theme_stylebox_override("hover", sb_hover)
	var sb_pressed := sb.duplicate()
	sb_pressed.bg_color = color.lerp(Color(0, 0, 0), 0.20)
	tile.add_theme_stylebox_override("pressed", sb_pressed)
	var sb_disabled := sb.duplicate()
	sb_disabled.bg_color = Color(color.r, color.g, color.b, 0.35)
	tile.add_theme_stylebox_override("disabled", sb_disabled)

	if on_press.is_valid():
		tile.pressed.connect(on_press)
	else:
		tile.disabled = true

	box.add_child(tile)

	var label := Label.new()
	label.text = jp_label
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_color_override("font_color", Color(0.12, 0.18, 0.10))
	box.add_child(label)
	return box


func _on_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close_phone()


func open_phone() -> void:
	_refresh()
	visible = true
	# Subtle pulse on the Contacts tile when a new memo is waiting, so the player
	# notices their journal grew (the red dot stays until they've viewed it).
	if _contacts_box and GameManager.any_contact_unread():
		_flash_box(_contacts_box)


func close_phone() -> void:
	visible = false


func play_payday(has_new_msg: bool) -> void:
	## Day-5+ payday on the phone: the ¥ wallet tile flashes with the coin
	## chime; then, if there are unread messages today, the ringtone plays and
	## the ✉ tile pulses. Replaces the old on-screen "¥X deposited" popup.
	if not visible:
		open_phone()
	_phone_sfx("res://assets/audio/sfx_coins.wav")
	_flash_box(_wallet_box)
	if has_new_msg:
		await get_tree().create_timer(0.9).timeout
		_phone_sfx("res://assets/audio/sfx_message.wav")
		_flash_box(_messages_box)


func notify_item_get() -> void:
	## Pop the phone and pulse the もちもの (Items) tile so the player notices a
	## newly-received item (e.g. Mom's umbrella on Day 11). The item itself is
	## already in the inventory by the time this is called.
	if not visible:
		open_phone()
	_phone_sfx("res://assets/audio/sfx_message.wav")
	_flash_box(_items_box)


func _flash_box(box: Control) -> void:
	if box == null:
		return
	box.modulate = Color(1, 1, 1, 1)
	var tw := create_tween().set_loops(3)
	tw.tween_property(box, "modulate", Color(1.8, 1.8, 1.8, 1), 0.16)
	tw.tween_property(box, "modulate", Color(1, 1, 1, 1), 0.22)


func _phone_sfx(path: String) -> void:
	if _sfx and ResourceLoader.exists(path):
		_sfx.stream = load(path)
		_sfx.play()


func _refresh() -> void:
	_time_label.text = "9:00"

	for c in _app_grid.get_children():
		c.queue_free()

	# Active apps. Items/quests stay tappable but disabled when empty so
	# they look "installed but quiet" rather than missing. Wallet is
	# always tappable — even at ¥0 the bank app still opens.
	# Items is ALWAYS tappable once the phone is owned: the inventory screen
	# hosts the phone tile + ケースをかえる (case swap), so it must stay
	# reachable even with zero consumables (otherwise the case swap is locked).
	var items_press = _open_items if (GameManager.has_phone or not GameManager.inventory.is_empty()) else Callable()
	var quests_press = _open_quests if not GameManager.quests.is_empty() else Callable()

	# Row 1 — the apps that actually do things.
	_wallet_box = _make_app_tile("¥",   "ウォレット", Color(0.93, 0.74, 0.22), _open_wallet)
	_app_grid.add_child(_wallet_box)
	_items_box = _make_app_tile("持",  "もちもの",   Color(0.45, 0.55, 0.85), items_press)
	_app_grid.add_child(_items_box)
	var quests_tile = _make_app_tile("任",  "クエスト",   Color(0.85, 0.50, 0.40), quests_press)
	if GameManager.quests_unread:
		_overlay_unread_dot(quests_tile)
	_app_grid.add_child(quests_tile)

	# Row 2 — Weather is gated by GameManager.weather_unlocked (flips on
	# when the N5 lesson introducing weather vocab lands). Map/Camera
	# remain placeholder slots until their own unlocks.
	var weather_press = _open_weather if GameManager.weather_unlocked else Callable()
	_app_grid.add_child(_make_app_tile("☀",  "てんき",     Color(0.40, 0.65, 0.90), weather_press))
	# Contacts (れんらくさき) — active once the phone is owned. Lists people met.
	# Red unread dot when a new memo has been earned but not yet seen.
	var contacts_press = _open_contacts if GameManager.has_phone else Callable()
	var contacts_tile = _make_app_tile("連",  "れんらくさき", Color(0.55, 0.60, 0.72), contacts_press)
	if GameManager.has_phone and GameManager.any_contact_unread():
		_overlay_unread_dot(contacts_tile)
	_contacts_box = contacts_tile
	_app_grid.add_child(contacts_tile)
	_app_grid.add_child(_make_app_tile("写",  "カメラ",     Color(0.65, 0.45, 0.65), Callable()))

	# Row 3 — Messages activates as soon as there's a thread. Red unread
	# dot painted on top of the tile when there are unread messages.
	var messages_press = _open_messages if not GameManager.messages.is_empty() else Callable()
	var messages_tile = _make_app_tile("✉",  "メッセージ", Color(0.45, 0.70, 0.55), messages_press)
	if GameManager.has_unread_messages():
		_overlay_unread_dot(messages_tile)
	_messages_box = messages_tile
	_app_grid.add_child(messages_tile)
	_app_grid.add_child(_make_app_tile("⚙",   "せってい",     Color(0.50, 0.55, 0.55), Callable()))
	_app_grid.add_child(_make_app_tile("時",  "とけい",       Color(0.40, 0.55, 0.75), Callable()))


func _open_items() -> void:
	if on_open_inventory.is_valid():
		on_open_inventory.call()


func _open_quests() -> void:
	GameManager.mark_quests_read()
	if on_open_quests.is_valid():
		on_open_quests.call()


func _open_wallet() -> void:
	if on_open_wallet.is_valid():
		on_open_wallet.call()


func _open_messages() -> void:
	if on_open_messages.is_valid():
		on_open_messages.call()


func _open_contacts() -> void:
	if on_open_contacts.is_valid():
		on_open_contacts.call()


func _overlay_unread_dot(tile_root: Control) -> void:
	## Drops a small red circle in the top-right corner of an app tile to
	## signal unread content (matches phone-OS messaging convention).
	var dot := Panel.new()
	dot.custom_minimum_size = Vector2(14, 14)
	dot.size = Vector2(14, 14)
	dot.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	dot.offset_left = -16
	dot.offset_top = -2
	dot.offset_right = -2
	dot.offset_bottom = 12
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.95, 0.20, 0.20)
	sb.border_color = Color(1, 1, 1, 0.95)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 7
	sb.corner_radius_top_right = 7
	sb.corner_radius_bottom_right = 7
	sb.corner_radius_bottom_left = 7
	dot.add_theme_stylebox_override("panel", sb)
	tile_root.add_child(dot)


func vibrate(duration: float = 0.7, intensity: float = 6.0) -> void:
	## Shake the phone panel briefly. Position oscillates around its
	## remembered home position with decaying random offset. Used when a
	## new message arrives — gives the player a haptic-ish cue.
	if _vibrate_tween and _vibrate_tween.is_valid():
		_vibrate_tween.kill()
	_panel.position = _panel_home_pos
	_vibrate_tween = create_tween()
	var steps := 12
	var step_dur := duration / float(steps)
	for i in range(steps):
		var decay: float = 1.0 - (float(i) / float(steps))
		var dx: float = (randf() * 2.0 - 1.0) * intensity * decay
		var dy: float = (randf() * 2.0 - 1.0) * intensity * decay
		_vibrate_tween.tween_property(_panel, "position",
			_panel_home_pos + Vector2(dx, dy), step_dur).set_trans(Tween.TRANS_SINE)
	_vibrate_tween.tween_property(_panel, "position", _panel_home_pos, step_dur)


func _open_weather() -> void:
	## Static for now — no game weather system yet. Closes the phone first
	## so the message popup sits on the world, not on top of the homescreen.
	close_phone()
	GameManager.show_message({
		"jp": "今日は晴れです。",
		"en": "It's sunny today.",
	})
