extends Node
## Singleton autoload — holds global game state and data references.
## Equivalent to the `game` state object and `termMap` from Game.js.

# --- Signals ---
signal conversation_started(conversation_data: Array, options: Dictionary)
signal conversation_ended
signal message_shown(message_data)
signal day_loaded(day_data: Dictionary)

# --- Game State ---
var in_conversation := false
var inspected: Dictionary = {}  # name → true
var doors: Dictionary = {}  # door_name → { "open": bool, "disabled": bool }
var void_seen := false
var void_asked: Dictionary = {}  # npc_name → true
var _interaction_lockout_until: int = 0  # ms; blocks new interactions briefly after a convo ends
var current_day: int = 1  # advanced by interacting with the laptop ("do a lesson")

# Resume: the scene the player was last in + their position there, so quitting
# mid-day and reloading drops them back where they left off (instead of the
# bedroom). Empty current_scene_id = fresh game → start at day-01-home.
var current_scene_id: String = ""
var resume_x: float = 0.0
var resume_y: float = 0.0

# --- Calendar / dates ---
# Game canon: Day 1 = Saturday April 25, 2026. Day 12 = Wednesday May 6, 2026
# (first work day after Golden Week — when school is introduced).
const START_YEAR: int  = 2026
const START_MONTH: int = 4
const START_DAY: int   = 25  # April 25, 2026 is a Saturday
# Saturday = 6 in our weekday convention (Sun=0, Mon=1, ..., Sat=6)
const START_WEEKDAY: int = 6
# Days per month for 2026 (non-leap). 2026 is not a leap year (2024 was the last).
const MONTH_LENGTHS_2026: Array = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_NAMES_JP: Array = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]
const MONTH_NAMES_EN: Array = ["January","February","March","April","May","June","July","August","September","October","November","December"]


func get_date_for_day(day: int) -> Dictionary:
	## Compute the in-game calendar date for in-game day N. Returns
	## {year, month (1-12), day (1-31), weekday (0=Sun..6=Sat)}.
	## Handles negative days too (dates before game start — used by the
	## calendar overlay to render the start of the month).
	var offset: int = day - 1
	var y: int = START_YEAR
	var m: int = START_MONTH
	var d: int = START_DAY + offset
	while d > MONTH_LENGTHS_2026[m - 1]:
		d -= MONTH_LENGTHS_2026[m - 1]
		m += 1
		if m > 12:
			m = 1
			y += 1
	while d <= 0:
		m -= 1
		if m < 1:
			m = 12
			y -= 1
		d += MONTH_LENGTHS_2026[m - 1]
	# GDScript's % returns negative for negative dividends; normalize to [0, 6].
	var weekday: int = ((START_WEEKDAY + offset) % 7 + 7) % 7
	return {"year": y, "month": m, "day": d, "weekday": weekday}


func get_current_date() -> Dictionary:
	return get_date_for_day(current_day)


func get_weekday_for_day(day: int) -> int:
	return (START_WEEKDAY + day - 1) % 7
var npc_day_talked: Dictionary = {}  # key "<npc>_day<N>" → true after first conversation on that day
# Day 2 narrative flags
var tree_count: int = 0          # cumulative examines on Days 2-4 (counts toward unlock)
var tree_san_unlocked: bool = false  # set true on the 3rd examine within Day 2-4 window
# Day 7 cake-interrogation state: asked = Rikizo raised the topic (Mom may
# have deflected to Tree-san); done = Mom has confessed she ate it.
var mom_cake_asked: bool = false
var mom_cake_done: bool = false
var dirt_count: int = 0
var told_mom_tree: bool = false
var void_seen_day2: bool = false
var told_dad_void_day2: bool = false
# Day 9: Rikizo handed Dad the present from the depaato. Gates the
# present-give beat so it fires once, and switches Dad/Mom to their
# post-present lines.
var gave_dad_present: bool = false

# Money — current yen total. Displayed in the inventory overlay alongside
# the regular items as a special money card. Used for purchases when
# stores unlock in later days.
var yen: int = 0

# Day 4: Dad returns the (repaired) smartphone. While unset, HUD shows the
# separate Inventory + Quest buttons; once set, those fold into a single
# Phone button that opens the phone UI hub.
var has_phone: bool = false

# Phone case system — each "case" is a full phone sprite. Equipping a case
# swaps the sprite used by TapToPayOverlay (and eventually the day-01
# pickup + HUD inventory tile). See campaigns/phone-cases.md.
const PHONE_CASE_REGISTRY := {
	"blank": {
		"name_en": "Blank",
		"name_jp": "ケースなし",
		"small_path": "res://assets/phone_cases/blank/sumaho_small.png",
		"large_path": "res://assets/phone_cases/blank/sumaho_large.png",
	},
	"tree_san": {
		"name_en": "Tree-san",
		"name_jp": "キーさん",
		"small_path": "res://assets/phone_cases/tree_san/sumaho_small.png",
		"large_path": "res://assets/ui/tap_to_pay/sumaho_large.png",
	},
	"red_promo": {
		"name_en": "Red Promo",
		"name_jp": "プロモ・レッド",
		"small_path": "res://assets/phone_cases/red_promo/sumaho_small.png",
		"large_path": "res://assets/phone_cases/red_promo/sumaho_large.png",
	},
}
# Default: player carries the tree-san case (matches existing pre-refactor
# behavior where the green-tree phone was Rikizo's only sprite).
var owned_phone_cases: Array = ["blank", "tree_san"]
var equipped_phone_case: String = "tree_san"
# Tree-san window: closes at end of Day 3 (= start of Day 4). When it
# closes, if the player hasn't befriended tree-san (tree_san_unlocked is
# still false), the tree-san phone case is removed forever and the equip
# falls back to blank. Tracked as a separate flag so the forfeit only
# fires once per playthrough.
var tree_san_window_expired: bool = false

# Day 5: Yamakawa first-meeting flag. Flips true after the konbini convo
# where Rikizo first encounters him + catches the onigiri fragment.
var met_yamakawa: bool = false
# Day 6: Yamakawa river-discovery flag. Flips true on the first
# river-bank conversation.
var met_yamakawa_river: bool = false
# Day 8: 駅長 (ekicho / station master) first-meeting flag. Flips true
# after the 4-line introduction convo at the station.
var met_ekicho: bool = false
# Day 7+: did Yamakawa eat his own onigiri at the konbini? Closes the
# narrative share-refusal arc; does NOT complete the onigiri quest
# (that requires Rikizo to eat his own purchased onigiri on Day 8+).
var yamakawa_ate_konbini: bool = false
# Day 10: Yamakawa's casual register-shift scene seen; broken-word beat asked.
var yamakawa_casual_day10: bool = false
var yamakawa_broken_word: bool = false
# Day 9: Yamakawa tells Rikizo that Yuki is behind the depaato. Flips true
# at the end of that conversation (fires once, takes priority over
# yamakawa's other day-9 beats). When true, the east river barrier
# (Bollard_Chain_Vertical on day-06-river) will be removed so Rikizo can
# follow the river path east toward the depaato.
var told_about_yuki: bool = false

# Day 10 電気 toggle: physical on/off states (reset each day in advance_day).
# tv_turned_on / lamp_toggled are persistent milestone flags (first-use).
var tv_on: bool = false
var lamp_on: bool = false
var tv_turned_on: bool = false
var lamp_toggled: bool = false
# Day 9: First time meeting Yuki on day-09-river-east. Fires the special
# void-noticing conversation — Yuki is the FIRST NPC to acknowledge that
# the white thing in the sky is real. Flips true on conversation end so
# the void-asking block doesn't re-fire on subsequent talks.
var met_yuki: bool = false

# Wallet ledger — append-only-from-the-front list of transactions for the
# phone's wallet app. Each entry: { date: "4/28", label: str, amount: int }.
# Newest entries first. Persists across reloads.
var wallet_history: Array = []

# Phone app unlock flags. Tiles render as visible-but-disabled placeholders
# while false, and only become tappable once the corresponding N5 lesson
# introduces the relevant vocabulary.
var weather_unlocked: bool = false

# Phone messages — one thread per contact. Each thread:
#   { contact_id, contact_name_jp, contact_name_en, avatar, lines: [
#       { from: "<contact_id>" or "me", jp, en, day }
#     ], unread: bool }
# unread flips to false once the player opens the thread.
var messages: Array = []
signal messages_changed
signal phone_force_open  # raised when the game wants to pop the phone overlay
						# (e.g. Day 5 "you got a message" beat)

# Inventory: Array of dicts { id, nameJp, nameEn, sprite, description }
var inventory: Array = []
# Quests: Array of dicts { id, jp, en, verb?, status, introducedDay, completedDay? }
#   jp is the rendered text — if `verb` is set and not "", inject it into the
#   "%s" placeholder; if null, render with a blank slot "＿＿".
var quests: Array = []
# Red-dot flag on the phone's Quests tile — set when a new quest is added,
# cleared when the player opens the quest log. Mirrors message unread.
var quests_unread: bool = false
# Track which interactive items have been "picked up" so the player can't grab
# the same physical bottle twice.
var picked_up: Dictionary = {}  # name → true

signal inventory_changed
signal quest_changed
# Fires when owned_phone_cases or equipped_phone_case changes (case bought,
# equipped, or removed via tree-san forfeit). HudOverlay re-icons the phone
# button; future inventory previews of the equipped case react too.
signal phone_case_changed

# --- Tracking ---
# Hidden stats accumulated across the whole game:
#   paranoia (int): +1 per void event Rikizo actually SEES
#   relationships[npc] (int): +1 per day Rikizo had a direct convo with that NPC
#   annoyance[npc] (int): +1 per annoying action toward that NPC, capped at
#                         once per (reason, npc) per day
var trackers := {
	"paranoia": 0,
	"relationships": {},
	"annoyance": {}
}
# Per-day caps — keys cleared on advance_day(). Persisted within the day so
# mid-day reloads don't allow farming +1s.
var annoyance_today: Dictionary = {}     # "<reason>_<npc>" → true
var relationship_today: Dictionary = {}  # "<npc>" → true

# --- Data ---
var day_data: Dictionary = {}
var term_map: Dictionary = {}  # id → entry dict
var glossary_entries: Array = []
var particles: Array = []
var characters: Array = []
var conjugation_rules: Dictionary = {}
var counter_rules: Dictionary = {}

# --- Loaded Assets ---
var convo_backgrounds: Dictionary = {}  # key → Texture2D
var alt_portraits: Dictionary = {}  # key → Texture2D

# Surface index for text processing (surface string → term id)
var _surface_index: Dictionary = {}

# --- Save path ---
const SAVE_PATH := "user://save_data.json"


func _ready() -> void:
	_load_save()


func load_day(day_json_path: String) -> void:
	## Load and parse a day.json file, then emit day_loaded.
	var file := FileAccess.open(day_json_path, FileAccess.READ)
	if not file:
		push_error("Cannot open day file: %s" % day_json_path)
		return
	var json_text := file.get_as_text()
	file.close()

	var json := JSON.new()
	var err := json.parse(json_text)
	if err != OK:
		push_error("JSON parse error in %s: %s" % [day_json_path, json.get_error_message()])
		return

	day_data = json.data
	_init_doors()
	day_loaded.emit(day_data)


func load_glossary(glossary_path: String) -> void:
	## Load a glossary JSON and merge entries into term_map.
	var data := _read_json(glossary_path)
	if data.has("entries"):
		for entry in data["entries"]:
			term_map[entry["id"]] = entry


func load_particles(particles_path: String) -> void:
	## Load particles.json and merge into term_map.
	var data := _read_json(particles_path)
	if data.has("particles"):
		for p in data["particles"]:
			term_map[p["id"]] = {
				"id": p["id"],
				"surface": p.get("particle", ""),
				"reading": p.get("reading", ""),
				"meaning": p.get("role", ""),
				"notes": p.get("explanation", ""),
				"type": "particle"
			}


func load_characters(characters_path: String) -> void:
	## Load characters.json and merge into term_map.
	var data := _read_json(characters_path)
	if data.has("characters"):
		for c in data["characters"]:
			var entry := {}
			for key in c:
				entry[key] = c[key]
			entry["type"] = "character"
			term_map[c["id"]] = entry


func load_conjugation_rules(path: String) -> void:
	conjugation_rules = _read_json(path)


func load_counter_rules(path: String) -> void:
	counter_rules = _read_json(path)


func build_surface_index() -> void:
	## Build a lookup: surface string → term ID, for text processing.
	_surface_index.clear()
	for id in term_map:
		var entry: Dictionary = term_map[id]
		if entry.has("surface") and entry["surface"] != "":
			_surface_index[entry["surface"]] = id


func get_surface_index() -> Dictionary:
	if _surface_index.is_empty():
		build_surface_index()
	return _surface_index


func lookup_term(id: String) -> Dictionary:
	return term_map.get(id, {})


# --- Door State ---

func _init_doors() -> void:
	doors.clear()
	if day_data.has("objects"):
		for obj in day_data["objects"]:
			if obj.get("isDoor", false):
				doors[obj["name"]] = {"open": false, "disabled": false}


func toggle_door(door_name: String) -> bool:
	## Toggle door open/closed. Returns the new state.
	if doors.has(door_name):
		doors[door_name]["open"] = not doors[door_name]["open"]
		return doors[door_name]["open"]
	return false


func is_door_open(door_name: String) -> bool:
	if doors.has(door_name):
		return doors[door_name]["open"]
	return false


func is_door_disabled(door_name: String) -> bool:
	if doors.has(door_name):
		return doors[door_name].get("disabled", false)
	return false


func disable_door(door_name: String) -> void:
	if doors.has(door_name):
		doors[door_name]["disabled"] = true


# --- Conversation ---

func start_conversation(conversation: Array, options: Dictionary = {}) -> void:
	in_conversation = true
	conversation_started.emit(conversation, options)


func end_conversation() -> void:
	if not in_conversation:
		return
	in_conversation = false
	# Brief lockout so the same input frame that closed the dialog doesn't
	# immediately re-trigger the NPC/object interaction that opened it.
	_interaction_lockout_until = Time.get_ticks_msec() + 250
	conversation_ended.emit()


func is_interaction_locked() -> bool:
	return Time.get_ticks_msec() < _interaction_lockout_until


func lock_interaction(ms: int = 350) -> void:
	## Public helper to start an interaction lockout (e.g. right after a
	## day transition so a buffered/double-tapped interact press doesn't
	## immediately fire whatever's near the new spawn point).
	_interaction_lockout_until = Time.get_ticks_msec() + ms


func show_message(msg) -> void:
	message_shown.emit(msg)


# --- Tracking ---

func increment_tracker(category: String, key: String = "", delta: int = 1) -> void:
	if key == "":
		# Top-level tracker (e.g. paranoia)
		trackers[category] = trackers.get(category, 0) + delta
	else:
		# Nested tracker (e.g. relationships.mom)
		if not trackers.has(category):
			trackers[category] = {}
		trackers[category][key] = trackers[category].get(key, 0) + delta
	_save()


func get_tracker(category: String, key: String = "") -> int:
	if key == "":
		return trackers.get(category, 0)
	if trackers.has(category):
		return trackers[category].get(key, 0)
	return 0


# --- Save / Load ---

signal day_advanced(new_day: int)


func reset_for_dev() -> void:
	## Wipes ALL in-memory game state back to a fresh Day 1 start AND deletes
	## the persisted save file. Intended for QA only; bind to a hotkey in
	## DayLoader so a reset is one keypress away.
	in_conversation = false
	inspected.clear()
	doors.clear()
	void_seen = false
	void_asked.clear()
	_interaction_lockout_until = 0
	current_day = 1
	current_scene_id = ""
	resume_x = 0.0
	resume_y = 0.0
	npc_day_talked.clear()
	tree_count = 0
	tree_san_unlocked = false
	mom_cake_asked = false
	mom_cake_done = false
	dirt_count = 0
	told_mom_tree = false
	void_seen_day2 = false
	told_dad_void_day2 = false
	gave_dad_present = false
	trackers = {"paranoia": 0, "relationships": {}, "annoyance": {}}
	annoyance_today.clear()
	relationship_today.clear()
	inventory.clear()
	quests.clear()
	quests_unread = false
	picked_up.clear()
	yen = 0
	has_phone = false
	owned_phone_cases = ["blank", "tree_san"]
	equipped_phone_case = "tree_san"
	tree_san_window_expired = false
	met_yamakawa = false
	met_yamakawa_river = false
	met_ekicho = false
	yamakawa_ate_konbini = false
	yamakawa_casual_day10 = false
	yamakawa_broken_word = false
	told_about_yuki = false
	met_yuki = false
	tv_on = false
	lamp_on = false
	tv_turned_on = false
	lamp_toggled = false
	wallet_history.clear()
	weather_unlocked = false
	messages.clear()
	inventory_changed.emit()
	quest_changed.emit()
	# Delete persisted save file so next launch also starts at Day 1.
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
	print("[DEV] GameManager state reset; save file deleted.")


func add_yen(amount: int, label: String = "") -> void:
	## Bump yen total. Emits inventory_changed so the HUD button + wallet
	## overlay refresh. When `label` is non-empty, a transaction row is
	## prepended to wallet_history (for the wallet app's history view).
	yen += amount
	if label != "":
		_log_wallet(amount, label)
	_save()
	inventory_changed.emit()


func spend_yen(amount: int, label: String = "") -> bool:
	## Try to deduct yen. Returns true on success; false if insufficient
	## (no change in that case). When `label` is non-empty and the spend
	## succeeds, a negative transaction is logged.
	if yen < amount:
		return false
	yen -= amount
	if label != "":
		_log_wallet(-amount, label)
	_save()
	inventory_changed.emit()
	return true


## Append a message to a contact's thread (creates the thread on first call).
## When `from` matches the contact_id, the message is "incoming" and marks
## the thread unread.
func add_message(contact_id: String, contact_name_jp: String, contact_name_en: String,
				avatar_path: String, from: String, jp: String, en: String) -> void:
	var thread = null
	for t in messages:
		if t.get("contact_id", "") == contact_id:
			thread = t
			break
	if thread == null:
		thread = {
			"contact_id": contact_id,
			"contact_name_jp": contact_name_jp,
			"contact_name_en": contact_name_en,
			"avatar": avatar_path,
			"lines": [],
			"unread": false,
		}
		messages.append(thread)
	thread["lines"].append({"from": from, "jp": jp, "en": en, "day": current_day})
	if from == contact_id:  # incoming message
		thread["unread"] = true
	_save()
	messages_changed.emit()


func mark_thread_read(contact_id: String) -> void:
	for t in messages:
		if t.get("contact_id", "") == contact_id:
			t["unread"] = false
			_save()
			messages_changed.emit()
			return


func has_unread_messages() -> bool:
	for t in messages:
		if t.get("unread", false):
			return true
	return false


func _log_wallet(amount: int, label: String) -> void:
	var d := get_current_date()
	wallet_history.insert(0, {
		"date": "%d/%d" % [int(d["month"]), int(d["day"])],
		"label": label,
		"amount": amount,
	})


func add_item(item: Dictionary, count: int = 1) -> void:
	## Add `count` of `item` to inventory. If an entry with the same `id`
	## already exists, its `quantity` is bumped (cart purchases stack as
	## ×N rather than being silently no-op'd). Otherwise a new entry is
	## appended with the given quantity.
	if count <= 0:
		return
	for owned in inventory:
		if owned.get("id") == item.get("id"):
			var q := int(owned.get("quantity", 1))
			owned["quantity"] = q + count
			_save()
			inventory_changed.emit()
			return
	var entry := item.duplicate(true)
	entry["quantity"] = max(1, count)
	inventory.append(entry)
	_save()
	inventory_changed.emit()


func has_item(item_id: String) -> bool:
	for owned in inventory:
		if owned.get("id") == item_id:
			return int(owned.get("quantity", 1)) > 0
	return false


func item_count(item_id: String) -> int:
	## How many of `item_id` are held. 0 if not held.
	for owned in inventory:
		if owned.get("id") == item_id:
			return int(owned.get("quantity", 1))
	return 0


func remove_item(item_id: String, count: int = 1) -> void:
	## Remove `count` of `item_id` from inventory. Decrements quantity;
	## removes the entry entirely when it hits zero. No-op if not held.
	if count <= 0:
		return
	for i in range(inventory.size()):
		if inventory[i].get("id") == item_id:
			var q := int(inventory[i].get("quantity", 1))
			var new_q := q - count
			if new_q <= 0:
				inventory.remove_at(i)
			else:
				inventory[i]["quantity"] = new_q
			_save()
			inventory_changed.emit()
			return


# ─── Phone case helpers ──────────────────────────────────────────────
# Lookups against PHONE_CASE_REGISTRY using the equipped case id. UI
# surfaces (TapToPayOverlay, HUD tile, day-01 pickup) call these instead
# of hardcoding sprite paths.

func phone_case_data(case_id: String = "") -> Dictionary:
	## Returns the registry entry for `case_id`, or the equipped case if
	## empty, falling back to "blank" if the id isn't registered.
	var id := case_id if case_id != "" else equipped_phone_case
	if PHONE_CASE_REGISTRY.has(id):
		return PHONE_CASE_REGISTRY[id]
	return PHONE_CASE_REGISTRY["blank"]


func get_phone_texture_large() -> Texture2D:
	## Returns the large (tap-to-pay scale) texture for the equipped case.
	var d := phone_case_data()
	return load(d["large_path"]) as Texture2D


func get_phone_texture_small() -> Texture2D:
	## Returns the small (HUD / map icon scale) texture for the equipped case.
	var d := phone_case_data()
	return load(d["small_path"]) as Texture2D


func add_phone_case(case_id: String) -> bool:
	## Add `case_id` to the player's owned cases. No-op if already owned.
	## Returns true iff the case was newly added.
	if not PHONE_CASE_REGISTRY.has(case_id):
		push_warning("Unknown phone case id: %s" % case_id)
		return false
	if owned_phone_cases.has(case_id):
		return false
	owned_phone_cases.append(case_id)
	_save()
	phone_case_changed.emit()
	return true


func remove_phone_case(case_id: String) -> bool:
	## Remove `case_id` from owned cases. If it was equipped, fall back to
	## "blank". Used by the tree-san day-3 forfeit logic. Returns true iff
	## the case was actually removed.
	if not owned_phone_cases.has(case_id):
		return false
	owned_phone_cases.erase(case_id)
	if equipped_phone_case == case_id:
		equipped_phone_case = "blank"
	_save()
	phone_case_changed.emit()
	return true


func equip_phone_case(case_id: String) -> bool:
	## Equip a case the player owns. Returns true iff the equip succeeded.
	if not owned_phone_cases.has(case_id):
		return false
	if equipped_phone_case == case_id:
		return true  # already equipped, no signal
	equipped_phone_case = case_id
	_save()
	phone_case_changed.emit()
	return true


func add_quest(quest: Dictionary) -> void:
	## Add a quest. Idempotent on `id`. Defaults status=open, introducedDay=current_day.
	for q in quests:
		if q.get("id") == quest.get("id"):
			return
	var q := quest.duplicate(true)
	q["status"] = q.get("status", "open")
	q["introducedDay"] = q.get("introducedDay", current_day)
	quests.append(q)
	quests_unread = true
	_save()
	quest_changed.emit()


func mark_quests_read() -> void:
	if quests_unread:
		quests_unread = false
		_save()


func complete_quest(quest_id: String) -> void:
	for q in quests:
		if q.get("id") == quest_id and q.get("status") == "open":
			q["status"] = "complete"
			q["completedDay"] = current_day
			_save()
			quest_changed.emit()
			return


func set_quest_verb(quest_id: String, verb: String, verb_en: String) -> void:
	## Fill in a quest's blank verb (e.g. おにぎりを＿＿ → おにぎりを食べる)
	## once the lesson that teaches the verb lands. Flags the quest list as
	## unread so the phone's Quests tile lights up.
	for q in quests:
		if q.get("id") == quest_id:
			if str(q.get("verb", "")) == verb:
				return  # already filled — idempotent, don't re-flag unread
			q["verb"] = verb
			q["verb_en"] = verb_en
			quests_unread = true
			_save()
			quest_changed.emit()
			return


func is_quest_complete(quest_id: String) -> bool:
	for q in quests:
		if q.get("id") == quest_id:
			return q.get("status") == "complete"
	return false


func has_quest(quest_id: String) -> bool:
	for q in quests:
		if q.get("id") == quest_id:
			return true
	return false


func quest_render_jp(q: Dictionary) -> String:
	## Render a quest's JP text, substituting verb (or a blank slot if missing).
	var template: String = str(q.get("jp", ""))
	if not template.contains("%s"):
		return template
	var v = q.get("verb")
	if v == null or str(v) == "":
		return template % "＿＿"
	return template % str(v)


func quest_render_en(q: Dictionary) -> String:
	var template: String = str(q.get("en", ""))
	if not template.contains("%s"):
		return template
	var v = q.get("verb_en")
	if v == null or str(v) == "":
		return template % "_____"
	return template % str(v)


## Daily teaching wage that auto-deposits at the start of every day from
## Day 4 on. Day 3 had the manual Dad-hands-it-over ceremony; Day 4 is when
## Dad explains the auto-payment via the phone, so from Day 4 forward the
## yen lands on day-advance, no NPC interaction required.
const DAILY_TEACHING_WAGE: int = 1000


## Highest in-game day that's been fully built and wired. advance_day()
## will refuse to advance past this so testing doesn't accidentally land
## on an unimplemented day. BUMP THIS each time a new day's chunks +
## dialog + transitions are wired up.
const MAX_BUILT_DAY: int = 10

func advance_day() -> void:
	if current_day >= MAX_BUILT_DAY:
		show_message({
			"jp": "Day %d はまだないです。" % (current_day + 1),
			"en": "Day %d isn't built yet — test block active." % (current_day + 1),
		})
		return
	current_day += 1
	# Day 1's void scene disables Front_Door permanently. On Day 2+ the
	# front door becomes the outside-map transition trigger, so re-enable it.
	if current_day == 2 and doors.has("Front_Door"):
		doors["Front_Door"]["disabled"] = false
	# Reset per-day stat caps so the new day starts fresh.
	annoyance_today.clear()
	relationship_today.clear()
	# Per-day narrative flags reset too — NPC dialogs, dirt comment counter.
	# tree_count and tree_san_unlocked are CROSS-DAY (they accumulate during
	# the Day 2-4 unlock window and lock in once unlocked).
	npc_day_talked.clear()
	dirt_count = 0
	# 電気 toggles return to OFF each morning (the milestone flags persist).
	tv_on = false
	lamp_on = false
	# Daily consumables (breakfast foods) reset each morning so the eating
	# ritual repeats — Mom makes food every day. The foods themselves are
	# day.json entries gated by appearsFromDay:7; clearing their picked_up
	# entries makes them re-appear on the kitchen table for the new day.
	for food in ["Salad", "Bread", "Coffee"]:
		if picked_up.has(food):
			picked_up.erase(food)
	# Auto teaching wage from Day 4 on. add_yen() emits inventory_changed
	# so the wallet/phone refresh, and the deposit popup gets shown by the
	# laptop's on_end so it lands inside the "Day X has begun" message.
	if current_day >= 4:
		add_yen(DAILY_TEACHING_WAGE, "せんせいのお金")
	else:
		_save()
	# Day 5: Yamakawa's first message lands on the phone. The phone-force-
	# open signal makes DayLoader pop the phone overlay + run the vibrate
	# animation so the player notices the new message.
	if current_day == 4 and not tree_san_window_expired:
		# End of Day 3 — tree-san befriending window closes. If the player
		# never reached the 3rd-examine threshold during the Day 2-4 window
		# (tree_san_unlocked stays false), the tree-san phone case is gone
		# forever. remove_phone_case auto-falls-back equipped → "blank" if
		# the player was carrying tree-san. Silent: HudOverlay + Inventory
		# refresh automatically via phone_case_changed.
		if not tree_san_unlocked and owned_phone_cases.has("tree_san"):
			remove_phone_case("tree_san")
		tree_san_window_expired = true
		_save()
	if current_day == 5:
		_seed_day5_yamakawa_message()
		phone_force_open.emit()
	if current_day == 6:
		_seed_day6_yamakawa_river_message()
		phone_force_open.emit()
	if current_day == 7:
		# 食べる + 飲む land on Day 7 — fill the blank verbs in the
		# onigiri and water quests, then buzz the phone so the player
		# notices the Quests tile lit up.
		set_quest_verb("onigiri_quest", "食べる", "Eat")
		set_quest_verb("drink_water", "飲む", "Drink")
		phone_force_open.emit()
	if current_day == 8:
		# 買う lands — commerce exists. Yamakawa texts to evangelize the
		# konbini shop so the player has a destination on opening Day 8.
		# Phone-buzz so the new message is noticed.
		_seed_day8_yamakawa_shop_message()
		phone_force_open.emit()
	if current_day == 10:
		# Day 10: Yuki's fragmented train/station text (points to the platform)
		# + Yamakawa's casual "I'm back outside the konbini" text.
		_seed_day10_yuki_message()
		_seed_day10_yamakawa_konbini_message()
		phone_force_open.emit()
	day_advanced.emit(current_day)


func _seed_day5_yamakawa_message() -> void:
	# Skip if Rikizo already has a Yamakawa thread (replay safety).
	for t in messages:
		if t.get("contact_id", "") == "yamakawa":
			return
	add_message(
		"yamakawa", "やまかわ", "Yamakawa",
		"res://assets/days/day-05-konbini/characters/yamakawa_head.png",
		"yamakawa",
		"りきぞ！コンビニに来て！",
		"Rikizo! Come to the convenience store!"
	)


func _seed_day6_yamakawa_river_message() -> void:
	# Day 6: Yamakawa has migrated to the river bank. He texts Rikizo on
	# Day 6 morning to tell him where he is. Skip on replay (only adds
	# the line once even if advance_day fires repeatedly).
	for t in messages:
		if t.get("contact_id", "") == "yamakawa":
			for line in t.get("lines", []):
				if line.get("jp", "") == "りきぞ、川に来て！":
					return
			break
	add_message(
		"yamakawa", "やまかわ", "Yamakawa",
		"res://assets/days/day-05-konbini/characters/yamakawa_head.png",
		"yamakawa",
		"りきぞ、川に来て！",
		"Rikizo, come to the river!"
	)


func _seed_day8_yamakawa_shop_message() -> void:
	# Day 8: 買う lands and the konbini opens for business. Yamakawa
	# evangelizes the shop in his morning text, anchoring the player's
	# first destination of the day. Replay-safe: skip if the line is
	# already on the thread.
	for t in messages:
		if t.get("contact_id", "") == "yamakawa":
			for line in t.get("lines", []):
				if line.get("jp", "") == "りきぞ！コンビニでおにぎりが買えますよ！":
					return
			break
	add_message(
		"yamakawa", "やまかわ", "Yamakawa",
		"res://assets/days/day-05-konbini/characters/yamakawa_head.png",
		"yamakawa",
		"りきぞ！コンビニでおにぎりが買えますよ！",
		"Rikizo! You can buy onigiri at the convenience store!"
	)


func _seed_day10_yuki_message() -> void:
	# Day 10: Yuki — the void-noticer — texts a fragmented, uneasy message
	# that points Rikizo toward the train at the station. Replay-safe.
	for t in messages:
		if t.get("contact_id", "") == "yuki":
			for line in t.get("lines", []):
				if line.get("jp", "") == "りきぞ...電車...駅...":
					return
			break
	add_message(
		"yuki", "ゆき", "Yuki",
		"res://assets/days/day-09-river-east/characters/yuki_head.png",
		"yuki",
		"りきぞ...電車...駅...",
		"Rikizo... train... station..."
	)


func _seed_day10_yamakawa_konbini_message() -> void:
	# Day 10: Yamakawa is back at the konbini — and casual now (G9). He
	# texts that he's outside it. Replay-safe.
	for t in messages:
		if t.get("contact_id", "") == "yamakawa":
			for line in t.get("lines", []):
				if line.get("jp", "") == "りきぞ！コンビニの外にいるよ。来て！":
					return
			break
	add_message(
		"yamakawa", "やまかわ", "Yamakawa",
		"res://assets/days/day-05-konbini/characters/yamakawa_head.png",
		"yamakawa",
		"りきぞ！コンビニの外にいるよ。来て！",
		"Rikizo! I'm outside the convenience store. Come over!"
	)


func annoy(npc: String, reason: String) -> void:
	## Bump annoyance for `npc` due to `reason`. Capped at +1 per (reason, npc)
	## per day so the player can't farm it by repeating the same action.
	var key := "%s_%s" % [reason, npc]
	if annoyance_today.has(key):
		return
	annoyance_today[key] = true
	increment_tracker("annoyance", npc, 1)


func bump_relationship(npc: String) -> void:
	## Bump relationship for `npc`. Capped at +1 per NPC per day — fires
	## the first time Rikizo has any conversation with them that day.
	if relationship_today.has(npc):
		return
	relationship_today[npc] = true
	increment_tracker("relationships", npc, 1)


func paranoia(amount: int = 1) -> void:
	## +1 per void event Rikizo SEES (front door void scene, gate void scene).
	## Not for just hearing about the void in dialogue.
	increment_tracker("paranoia", "", amount)


func _save() -> void:
	var save_data := {
		"trackers": trackers,
		"void_seen": void_seen,
		"void_asked": void_asked,
		"current_day": current_day,
		"current_scene_id": current_scene_id,
		"resume_x": resume_x,
		"resume_y": resume_y,
		"inventory": inventory,
		"quests": quests,
		"quests_unread": quests_unread,
		"picked_up": picked_up,
		"inspected": inspected,
		"annoyance_today": annoyance_today,
		"relationship_today": relationship_today,
		"npc_day_talked": npc_day_talked,
		"tree_count": tree_count,
		"tree_san_unlocked": tree_san_unlocked,
		"mom_cake_asked": mom_cake_asked,
		"mom_cake_done": mom_cake_done,
		"dirt_count": dirt_count,
		"told_mom_tree": told_mom_tree,
		"void_seen_day2": void_seen_day2,
		"told_dad_void_day2": told_dad_void_day2,
		"gave_dad_present": gave_dad_present,
		"yen": yen,
		"has_phone": has_phone,
		"owned_phone_cases": owned_phone_cases,
		"equipped_phone_case": equipped_phone_case,
		"tree_san_window_expired": tree_san_window_expired,
		"met_yamakawa": met_yamakawa,
		"met_yamakawa_river": met_yamakawa_river,
		"met_ekicho": met_ekicho,
		"yamakawa_ate_konbini": yamakawa_ate_konbini,
		"yamakawa_casual_day10": yamakawa_casual_day10,
		"yamakawa_broken_word": yamakawa_broken_word,
		"told_about_yuki": told_about_yuki,
		"met_yuki": met_yuki,
		"tv_on": tv_on,
		"lamp_on": lamp_on,
		"tv_turned_on": tv_turned_on,
		"lamp_toggled": lamp_toggled,
		"wallet_history": wallet_history,
		"weather_unlocked": weather_unlocked,
		"messages": messages,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		file.close()


func _load_save() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var json := JSON.new()
	if json.parse(file.get_as_text()) == OK and json.data is Dictionary:
		var data: Dictionary = json.data
		if data.has("trackers"):
			trackers = data["trackers"]
		if data.has("void_seen"):
			void_seen = data["void_seen"]
		if data.has("void_asked"):
			void_asked = data["void_asked"]
		if data.has("current_day"):
			current_day = int(data["current_day"])
		if data.has("current_scene_id"):
			current_scene_id = str(data["current_scene_id"])
		if data.has("resume_x"):
			resume_x = float(data["resume_x"])
		if data.has("resume_y"):
			resume_y = float(data["resume_y"])
		if data.has("inventory"):
			inventory = data["inventory"]
		if data.has("quests"):
			quests = data["quests"]
		if data.has("quests_unread"):
			quests_unread = bool(data["quests_unread"])
		if data.has("picked_up"):
			picked_up = data["picked_up"]
		if data.has("inspected"):
			inspected = data["inspected"]
		if data.has("annoyance_today"):
			annoyance_today = data["annoyance_today"]
		if data.has("relationship_today"):
			relationship_today = data["relationship_today"]
		if data.has("npc_day_talked"):
			npc_day_talked = data["npc_day_talked"]
		if data.has("tree_count"):
			tree_count = int(data["tree_count"])
		if data.has("mom_cake_asked"):
			mom_cake_asked = bool(data["mom_cake_asked"])
		if data.has("mom_cake_done"):
			mom_cake_done = bool(data["mom_cake_done"])
		if data.has("tree_san_unlocked"):
			tree_san_unlocked = bool(data["tree_san_unlocked"])
		if data.has("dirt_count"):
			dirt_count = int(data["dirt_count"])
		if data.has("told_mom_tree"):
			told_mom_tree = bool(data["told_mom_tree"])
		if data.has("void_seen_day2"):
			void_seen_day2 = bool(data["void_seen_day2"])
		if data.has("told_dad_void_day2"):
			told_dad_void_day2 = bool(data["told_dad_void_day2"])
		if data.has("gave_dad_present"):
			gave_dad_present = bool(data["gave_dad_present"])
		if data.has("yen"):
			yen = int(data["yen"])
		if data.has("has_phone"):
			has_phone = bool(data["has_phone"])
		# Pre-phone-cases-refactor saves had a regular "sumaho" inventory
		# item alongside has_phone=true. The phone now renders as a
		# synthetic tile (see InventoryOverlay._make_phone_item), so strip
		# the legacy entry on load to avoid showing two phone tiles.
		if has_phone and inventory.size() > 0:
			var filtered: Array = []
			for it in inventory:
				if str(it.get("id", "")) != "sumaho":
					filtered.append(it)
			if filtered.size() != inventory.size():
				inventory = filtered
		if data.has("owned_phone_cases"):
			owned_phone_cases = data["owned_phone_cases"]
		if data.has("equipped_phone_case"):
			equipped_phone_case = String(data["equipped_phone_case"])
			# If the saved equipped case isn't registered (e.g. removed from
			# the registry), fall back to blank to avoid load-time crashes.
			if not PHONE_CASE_REGISTRY.has(equipped_phone_case):
				equipped_phone_case = "blank"
		if data.has("tree_san_window_expired"):
			tree_san_window_expired = bool(data["tree_san_window_expired"])
		if data.has("met_yamakawa"):
			met_yamakawa = bool(data["met_yamakawa"])
		if data.has("met_yamakawa_river"):
			met_yamakawa_river = bool(data["met_yamakawa_river"])
		if data.has("met_ekicho"):
			met_ekicho = bool(data["met_ekicho"])
		if data.has("yamakawa_ate_konbini"):
			yamakawa_ate_konbini = bool(data["yamakawa_ate_konbini"])
		if data.has("yamakawa_casual_day10"):
			yamakawa_casual_day10 = bool(data["yamakawa_casual_day10"])
		if data.has("yamakawa_broken_word"):
			yamakawa_broken_word = bool(data["yamakawa_broken_word"])
		if data.has("told_about_yuki"):
			told_about_yuki = bool(data["told_about_yuki"])
		if data.has("met_yuki"):
			met_yuki = bool(data["met_yuki"])
		if data.has("tv_on"):
			tv_on = bool(data["tv_on"])
		if data.has("lamp_on"):
			lamp_on = bool(data["lamp_on"])
		if data.has("tv_turned_on"):
			tv_turned_on = bool(data["tv_turned_on"])
		if data.has("lamp_toggled"):
			lamp_toggled = bool(data["lamp_toggled"])
		if data.has("wallet_history"):
			wallet_history = data["wallet_history"]
		if data.has("weather_unlocked"):
			weather_unlocked = bool(data["weather_unlocked"])
		if data.has("messages"):
			messages = data["messages"]
	file.close()
	_migrate_save()


func _migrate_save() -> void:
	## One-shot cleanup of state from earlier builds. Currently:
	## Older Day 5 code gave Rikizo an onigiri / onigiri_fragment on
	## first meeting Yamakawa and auto-completed onigiri_quest on
	## pickup. New design: Rikizo gets no onigiri until Day 8 (買う),
	## and the Day 5/6 quest resolves ONLY by watching Yamakawa eat
	## his at the Day 7 konbini. Strip the stale item + reopen the
	## quest so the Day 7 Yamakawa beat can complete it properly.
	var dirty := false
	var cleaned: Array = []
	for it in inventory:
		var id_ := str(it.get("id", ""))
		if id_ == "onigiri" or id_ == "onigiri_fragment":
			dirty = true
			continue
		cleaned.append(it)
	if dirty:
		inventory = cleaned
	for q in quests:
		if q.get("id") == "onigiri_quest" and q.get("status") == "complete":
			q["status"] = "open"
			if q.has("completedDay"):
				q.erase("completedDay")
			dirty = true
	if dirty:
		_save()


# --- Helpers ---

func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		push_error("Cannot open: %s" % path)
		return {}
	var text := file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(text) != OK:
		push_error("JSON error in %s: %s" % [path, json.get_error_message()])
		return {}
	if json.data is Dictionary:
		return json.data
	return {}
