extends CanvasLayer
## Persistent HUD with tap-friendly buttons for Inventory and Quest Log.
## Buttons appear only after the corresponding game system unlocks
## (i.e., once `inventory` or `quests` has at least one entry).
## Once Rikizo receives the smartphone on Day 4, the Inventory and Quest
## buttons fold into a single Phone button — the phone overlay becomes
## the entry point to both.
## Mobile/Switch-friendly — no keyboard shortcuts required.

@export var on_open_inventory: Callable
@export var on_open_quests: Callable
@export var on_open_phone: Callable

var _inv_button: Button
var _quest_button: Button
var _phone_button: Button
var _anchor: Control  # top-right HUD anchor; inset from the safe area


func _ready() -> void:
	layer = 9  # below all the overlays (10+) but above the world
	_build_ui()
	_apply_safe_area()
	SafeArea.changed.connect(_apply_safe_area)  # re-inset on orientation change
	_refresh()
	GameManager.inventory_changed.connect(_refresh)
	GameManager.quest_changed.connect(_refresh)
	GameManager.day_advanced.connect(func(_d): _refresh())
	# Re-icon the phone button when the player swaps cases.
	GameManager.phone_case_changed.connect(_update_phone_icon)


func _build_ui() -> void:
	# Top-right corner stack — avoids the bottom touch controls + the
	# bottom-anchored message popup + dialog bubble. Right margin is tight
	# (8 px) so the phone icon nests just shy of the NE corner once it
	# becomes the primary HUD button.
	var anchor := Control.new()
	anchor.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	anchor.offset_left = -180.0
	anchor.offset_top = 10.0
	anchor.offset_right = -8.0
	anchor.offset_bottom = 220.0
	anchor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(anchor)
	_anchor = anchor

	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 8)
	anchor.add_child(vbox)

	_phone_button = _make_phone_icon_button()
	_phone_button.pressed.connect(_on_phone_pressed)
	vbox.add_child(_phone_button)

	_inv_button = _make_button("もちもの", "Inventory")
	_inv_button.pressed.connect(_on_inv_pressed)
	vbox.add_child(_inv_button)

	_quest_button = _make_button("クエスト", "Quest Log")
	_quest_button.pressed.connect(_on_quest_pressed)
	vbox.add_child(_quest_button)


# Keep the top-right HUD clear of the notch / Dynamic Island (right + top insets).
# Base offsets are top=10, right=-8; safe-area insets are ADDED on top of those.
func _apply_safe_area() -> void:
	if _anchor == null:
		return
	var i: Dictionary = SafeArea.insets()
	_anchor.offset_top = 10.0 + i.get("top", 0.0)
	_anchor.offset_bottom = 220.0 + i.get("top", 0.0)
	_anchor.offset_left = -180.0 - i.get("right", 0.0)
	_anchor.offset_right = -8.0 - i.get("right", 0.0)


func _update_phone_icon() -> void:
	## Refresh the phone button's icon to the equipped case's small sprite.
	## Connected to GameManager.phone_case_changed.
	if _phone_button == null:
		return
	var tex := GameManager.get_phone_texture_small()
	if tex:
		_phone_button.icon = tex


func _make_phone_icon_button() -> Button:
	## Phone HUD button: shows the smartphone sprite as the icon, no text.
	## Square, transparent panel — the phone art IS the button. Right-
	## aligned and sized larger than the legacy text buttons so it reads
	## as the primary tap target once it replaces them.
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(108, 108)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_END
	btn.flat = true
	# Don't steal keyboard focus — otherwise the player's space-to-interact
	# fires ui_accept on this button instead of triggering an examine.
	btn.focus_mode = Control.FOCUS_NONE
	# Phone icon comes from the equipped phone case via GameManager so the
	# HUD button updates whenever the player swaps cases.
	var phone_tex := GameManager.get_phone_texture_small()
	if phone_tex:
		btn.icon = phone_tex
		btn.expand_icon = true
	# Soft rounded backing so the icon has a tap-affordance.
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.98, 0.96, 0.91, 0.70)
	sb.border_color = Color(0.35, 0.27, 0.18, 0.85)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 14
	sb.corner_radius_top_right = 14
	sb.corner_radius_bottom_right = 14
	sb.corner_radius_bottom_left = 14
	sb.shadow_color = Color(0, 0, 0, 0.3)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 2)
	sb.content_margin_left = 6
	sb.content_margin_right = 6
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	btn.add_theme_stylebox_override("normal", sb)
	var sb_hover := sb.duplicate()
	sb_hover.bg_color = Color(1.0, 0.98, 0.94, 0.95)
	btn.add_theme_stylebox_override("hover", sb_hover)
	var sb_pressed := sb.duplicate()
	sb_pressed.bg_color = Color(0.88, 0.84, 0.74, 0.95)
	btn.add_theme_stylebox_override("pressed", sb_pressed)
	return btn


func _make_button(jp: String, en: String) -> Button:
	var btn := Button.new()
	btn.text = "%s\n%s" % [jp, en]
	btn.custom_minimum_size = Vector2(160, 52)
	btn.add_theme_font_size_override("font_size", 14)
	btn.add_theme_color_override("font_color", Color(0.12, 0.08, 0.05))
	btn.focus_mode = Control.FOCUS_NONE

	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.98, 0.96, 0.91, 0.95)
	sb.border_color = Color(0.35, 0.27, 0.18)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 10
	sb.corner_radius_top_right = 10
	sb.corner_radius_bottom_right = 10
	sb.corner_radius_bottom_left = 10
	sb.shadow_color = Color(0, 0, 0, 0.3)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 2)
	btn.add_theme_stylebox_override("normal", sb)

	var sb_hover := sb.duplicate()
	sb_hover.bg_color = Color(1.0, 0.98, 0.94, 1.0)
	btn.add_theme_stylebox_override("hover", sb_hover)

	var sb_pressed := sb.duplicate()
	sb_pressed.bg_color = Color(0.92, 0.88, 0.80, 1.0)
	btn.add_theme_stylebox_override("pressed", sb_pressed)
	return btn


func _refresh() -> void:
	# Once Rikizo has the phone, Inventory + Quest buttons disappear —
	# both live inside the phone overlay. Before then, fall back to the
	# separate buttons so pre-Day-4 unlocks still work.
	if GameManager.has_phone:
		_phone_button.visible = true
		_inv_button.visible = false
		_quest_button.visible = false
	else:
		_phone_button.visible = false
		_inv_button.visible = not GameManager.inventory.is_empty()
		_quest_button.visible = not GameManager.quests.is_empty()


func _on_inv_pressed() -> void:
	if on_open_inventory.is_valid():
		on_open_inventory.call()


func _on_quest_pressed() -> void:
	if on_open_quests.is_valid():
		on_open_quests.call()


func _on_phone_pressed() -> void:
	if on_open_phone.is_valid():
		on_open_phone.call()
