extends CanvasLayer
## Screen-space weather overlay (Day 11+): a faint overcast tint + custom-drawn
## diagonal rain. Rain is drawn with draw_line() on an inner Control, which
## renders reliably on a CanvasLayer — the previous CPUParticles2D-on-CanvasLayer
## setup didn't draw at all. Driven by GameManager.weather_for_day(); DayLoader
## gates it to outdoor scenes (interiors stay clear).

var _tint: ColorRect
var _rain: RainLayer
var _kind := "clear"


# Rain streaks now live in the shared RainLayer.gd (class_name RainLayer) so the
# DialogueOverlay can reuse them; _rain = RainLayer.new() below resolves to it.


func _ready() -> void:
	layer = 8  # above world (z 0–100), below HudOverlay(9)/DialogueOverlay(10)
	_tint = ColorRect.new()
	_tint.color = Color(0.45, 0.5, 0.62, 0.0)  # blue-grey overcast, faded in for rain
	_tint.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_tint)
	_rain = RainLayer.new()
	add_child(_rain)
	set_weather("clear")


func set_weather(kind: String) -> void:
	_kind = kind
	if kind == "rain":
		_rain.start()
		_fade_tint(0.12)
	else:  # "clear" (and any future-unhandled kind)
		_rain.stop()
		_fade_tint(0.0)


func _fade_tint(a: float) -> void:
	var tw := create_tween()
	tw.tween_property(_tint, "color:a", a, 0.8)
