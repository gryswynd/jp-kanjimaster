class_name TermProcessor
## Processes Japanese text and wraps vocabulary terms in BBCode [url] tags
## so they are tappable in RichTextLabel. Mirrors the text processing from Game.js.
##
## Usage:
##   var tagged := TermProcessor.process_text("おはよう", index, term_map)


static func process_text(text: String, surface_index: Dictionary = {}, term_map: Dictionary = {}) -> String:
	## Find all known term surfaces in the text and wrap them in [url] tags.
	## Longest match wins (prevents nesting: 今日 beats 今 + 日).
	if surface_index.is_empty():
		return text

	# Collect all surfaces that appear in the text
	var matches: Array = []

	for surface: String in surface_index:
		if surface == "":
			continue
		var search_from := 0
		while true:
			var pos := text.find(surface, search_from)
			if pos < 0:
				break
			matches.append({
				"surface": surface,
				"id": surface_index[surface],
				"pos": pos,
				"len": surface.length()
			})
			search_from = pos + 1

	if matches.is_empty():
		return text

	# Sort by position, then longest first (so longest match wins at each position)
	matches.sort_custom(_sort_matches)

	# Greedy non-overlapping selection: longest match at each position
	var selected: Array = []
	var covered_to := -1

	for m: Dictionary in matches:
		if m["pos"] >= covered_to:
			var dominated := false
			for s: Dictionary in selected:
				if m["pos"] >= s["pos"] and m["pos"] + m["len"] <= s["pos"] + s["len"]:
					dominated = true
					break
			if not dominated:
				selected.append(m)
				covered_to = m["pos"] + m["len"]

	if selected.is_empty():
		return text

	# Sort selected by position
	selected.sort_custom(_sort_by_pos)

	# Build BBCode output
	var result := ""
	var cursor := 0

	for m: Dictionary in selected:
		if m["pos"] > cursor:
			result += text.substr(cursor, m["pos"] - cursor)

		var term_id: String = m["id"]
		var entry: Dictionary = term_map.get(term_id, {})
		var color := _get_term_color(entry)
		result += "[url=%s][color=%s]%s[/color][/url]" % [term_id, color, m["surface"]]
		cursor = m["pos"] + m["len"]

	if cursor < text.length():
		result += text.substr(cursor)

	return result


static func _sort_matches(a: Dictionary, b: Dictionary) -> bool:
	if a["pos"] != b["pos"]:
		return a["pos"] < b["pos"]
	return a["len"] > b["len"]


static func _sort_by_pos(a: Dictionary, b: Dictionary) -> bool:
	return a["pos"] < b["pos"]


static func _get_term_color(entry: Dictionary) -> String:
	var entry_type: String = entry.get("type", "vocab")
	match entry_type:
		"character":
			return "#f8a5c2"
		"particle":
			return "#a29bfe"
		_:
			return "#4e54c8"
