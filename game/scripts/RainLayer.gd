class_name RainLayer
extends Control
## Custom-drawn diagonal rain streaks (draw_line in _process/_draw — renders
## reliably anywhere, unlike CPUParticles2D on a CanvasLayer). Shared by the
## screen-space WeatherOverlay AND the DialogueOverlay (so rain persists into
## outdoor conversations). Call start()/stop() to toggle.

const COUNT := 150
const FALL := 950.0      # px/s downward
const LEAN := 0.16       # horizontal drift as a fraction of the fall speed
var active := false
var streaks: Array = []  # each: {p:Vector2, ln:float, spd:float, a:float, w:float}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)


func _vp() -> Vector2:
	var s := size
	if s.x < 1.0 or s.y < 1.0:
		s = get_viewport_rect().size
	return s


func start() -> void:
	# Seed streaks spread across the whole screen so it's already raining on show.
	var sz := _vp()
	streaks.clear()
	for i in COUNT:
		streaks.append({
			"p": Vector2(randf() * (sz.x + 60.0) - 30.0, randf() * (sz.y + 60.0) - 30.0),
			"ln": randf_range(14.0, 26.0),
			"spd": FALL * randf_range(0.85, 1.2),
			"a": randf_range(0.25, 0.6),
			"w": randf_range(1.0, 2.0),
		})
	active = true
	queue_redraw()


func stop() -> void:
	active = false
	queue_redraw()


func _process(delta: float) -> void:
	if not active:
		return
	var sz := _vp()
	for s in streaks:
		var p: Vector2 = s["p"]          # Vector2 is a value type — edit a copy, write back
		p.y += s["spd"] * delta
		p.x += s["spd"] * LEAN * delta
		if p.y - s["ln"] > sz.y:          # fell past the bottom → respawn at top
			p.y = -randf() * 60.0
			p.x = randf() * (sz.x + 60.0) - 30.0
		elif p.x - 30.0 > sz.x:           # drifted off the right → wrap left
			p.x = -10.0
		s["p"] = p
	queue_redraw()


func _draw() -> void:
	if not active:
		return
	var dir := Vector2(LEAN, 1.0).normalized()
	for s in streaks:
		var p: Vector2 = s["p"]
		var tail: Vector2 = p - dir * float(s["ln"])
		draw_line(tail, p, Color(0.80, 0.87, 0.98, s["a"]), float(s["w"]))
