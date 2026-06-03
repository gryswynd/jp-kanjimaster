extends Node
## Autoload: reports the device safe-area inset in the game's LOGICAL coordinate
## space (the 960x540 viewport), so UI can stay clear of the iPhone notch /
## Dynamic Island / home indicator and Android cutouts. On platforms with no
## insets (Switch, Steam Deck, desktop) every value is 0, so callers are no-ops
## there.
##
## Usage from any CanvasLayer/Control:
##   var i := SafeArea.insets()   # {left, top, right, bottom} in logical px
##   anchor.offset_top += i.top
##   anchor.offset_right -= i.right
##
## Re-query on resize (orientation change) via the `changed` signal.

signal changed

var _insets := {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}


func _ready() -> void:
	_recompute()
	get_tree().root.size_changed.connect(_recompute)


func insets() -> Dictionary:
	return _insets


func _recompute() -> void:
	var win := DisplayServer.window_get_size()
	var safe := DisplayServer.get_display_safe_area()  # Rect2i in physical px
	# Guard against zero / uninitialized values (e.g. headless).
	if win.x <= 0 or win.y <= 0 or safe.size.x <= 0:
		_insets = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}
		emit_signal("changed")
		return

	# Physical insets (px) on each edge.
	var phys_left := float(safe.position.x)
	var phys_top := float(safe.position.y)
	var phys_right := float(win.x - (safe.position.x + safe.size.x))
	var phys_bottom := float(win.y - (safe.position.y + safe.size.y))

	# Convert physical px → logical px. The world renders at 960x540 stretched
	# across the window, so scale = logical / physical per axis.
	var vp := get_viewport().get_visible_rect().size  # logical viewport size
	var sx: float = vp.x / float(win.x)
	var sy: float = vp.y / float(win.y)

	_insets = {
		"left": max(0.0, phys_left * sx),
		"top": max(0.0, phys_top * sy),
		"right": max(0.0, phys_right * sx),
		"bottom": max(0.0, phys_bottom * sy),
	}
	emit_signal("changed")
