# This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2023-2026 Joshua Langley and contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. See the LICENSE file in the project root,
# or <https://www.gnu.org/licenses/>.

class_name Quest
extends RefCounted
## Port of client/js/quest.js and achievement.js. Quest text comes from the server.

enum QuestType { KILLMOBKIND = 1, GETITEMKIND = 2, KILLMOBS = 3, HIDEANDSEEK = 4, USENODE = 5 }
enum Status { STARTED = 0, INPROGRESS = 1, COMPLETE = 2 }

var id := 0
var type := 0
var npc_quest_id := 0
var count := 0
var status := 0
var data1 := 0
var data2 := 0
var object = null    # {type, kind, count} or null
var object2 = null
var desc: Array = []  # [[speaker(0 npc / 1 player), text], ...]
var summary := ""
var summary_path = null  # lang path; sent only when the quest starts / at login
var delay := Types.DIALOGUE_DELAY_DEFAULT  # ms per desc line (server sends it only if not default)

## The gameserver decides which quest text applies (gameserver/js/
## questtext.js): every WC_QUEST (and each quest in the login packet) carries
## lang *paths* for the description and summary (e.g. ["QUESTS", "200100", 1])
## and the display delay. The client retrieves the lang value for each path
## and generates the fill-in variables (%name%, %count%, %name2%, %count2%)
## itself from the quest's mob/item/npc kinds (get_quest_vars()).

static func from_array(arr: Array) -> Quest:
	var q := Quest.new()
	q.update(arr)
	return q


## arr: the 13 quest fields, optionally followed by the server's text
## ({desc[, summary][, delay]} -- a Dictionary from WC_QUEST, or
## URI-encoded JSON from the comma-joined login packet). The summary is only
## sent when the quest starts / at login -- later updates keep it.
func update(arr: Array) -> void:
	var text = arr[13] if arr.size() > 13 else null
	var a: Array = []
	for i in range(mini(arr.size(), 13)):
		a.append(Types.to_int(arr[i]))
	while a.size() < 13:
		a.append(0)
	id = a[0]
	type = a[1]
	npc_quest_id = a[2]
	count = a[3]
	status = a[4]
	data1 = a[5]
	data2 = a[6]
	object = {"type": a[7], "kind": a[8], "count": a[9]}
	object2 = {"type": a[10], "kind": a[11], "count": a[12]} if (a[10] != 0 or a[11] != 0 or a[12] != 0) else null
	if text != null:
		set_text(text)


func set_text(text) -> void:
	if text is String:
		text = JSON.parse_string(String(text).uri_decode())
	if not (text is Dictionary):
		return
	var vars := get_quest_vars(type, object, object2, count)
	desc = lang_lines(text.get("desc"), vars)
	if text.has("summary"):
		summary_path = text.get("summary")
	# Re-filled on every update since %count2% (progress) can change.
	summary = lang_text(summary_path, vars)
	var dl := Types.to_int(text.get("delay", 0))
	delay = dl if dl > 0 else Types.DIALOGUE_DELAY_DEFAULT


## The quest fill-in variables, generated client-side from the quest's
## objects (port of the old text_template()):
##   KILLMOBKIND: %name% mob, %count% kill count
##   GETITEMKIND: %name% item, %count% item count, %name2% mob dropping it
##   HIDEANDSEEK: %name% npc
##   USENODE:     %count% node count
##   all:         %count2% current progress
static func get_quest_vars(q_type: int, obj, obj2, q_count: int) -> Dictionary:
	var vars := {"count2": q_count}
	match q_type:
		QuestType.GETITEMKIND:
			if obj2 != null:
				var loot := GameData.get_loot(1000 + int(obj2.kind))
				if loot.is_empty():
					loot = GameData.get_loot(int(obj2.kind))
				if not loot.is_empty():
					vars["name"] = _cap(str(loot.get("name", "")))
				vars["count"] = int(obj2.count)
			if obj != null:
				var mob := GameData.get_mob(int(obj.kind))
				if not mob.is_empty():
					vars["name2"] = _cap(str(mob.key))
		QuestType.KILLMOBKIND, QuestType.KILLMOBS:
			if obj != null:
				var mob := GameData.get_mob(int(obj.kind))
				if not mob.is_empty():
					vars["name"] = _cap(str(mob.key))
				vars["count"] = int(obj.count)
		QuestType.HIDEANDSEEK:
			if obj != null:
				vars["name"] = str(GameData.get_npc(int(obj.kind)).get("name", ""))
		QuestType.USENODE:
			if obj != null:
				vars["count"] = int(obj.count)
	return vars


static func _cap(t: String) -> String:
	return t if t == "" else t[0].to_upper() + t.substr(1)


## Replaces `%key%` and `{key}` for every key in `vars` (an Array gives
## {0}, {1}, ...; a Dictionary gives its own key names).
static func fill_text(txt: String, vars) -> String:
	if vars is Array:
		for i in range(vars.size()):
			var v := Types.to_str(vars[i])
			txt = txt.replace("{%d}" % i, v).replace("%%%d%%" % i, v)
	elif vars is Dictionary:
		for k in vars.keys():
			var v := Types.to_str(vars[k])
			txt = txt.replace("{%s}" % str(k), v).replace("%" + str(k) + "%", v)
	return txt


## Lang value at `path` (Array of keys/indices into GameData.lang), or null.
static func get_lang_path(path):
	if not (path is Array) or path.is_empty():
		return null
	var value = GameData.lang
	for key in path:
		if value is Dictionary:
			value = value.get(str(key))
		elif value is Array:
			var i := Types.to_int(key)
			if i < 0 or i >= value.size():
				return null
			value = value[i]
		else:
			return null
	return value


## Any lang dialogue shape -> [[speaker, text], ...] (same rules as the
## server's questtext.js normalizeLines): "text", [0, "text"], ["a", "b"],
## [[0, "a"], [1, "b"]].
static func normalize_lines(raw) -> Array:
	var out: Array = []
	if raw == null:
		return out
	if not (raw is Array):
		return [[0, str(raw)]]
	if raw.size() >= 2 and (raw[0] is int or raw[0] is float) and not (raw[1] is Array):
		return [[1 if Types.to_int(raw[0]) != 0 else 0, str(raw[1])]]
	for entry in raw:
		if entry is Array:
			if entry.size() >= 2:
				out.append([1 if Types.to_int(entry[0]) != 0 else 0, str(entry[1])])
		elif entry != null:
			out.append([0, str(entry)])
	return out


## Dialogue lines for a server-sent lang path, with the vars filled in.
static func lang_lines(path, vars) -> Array:
	var out: Array = []
	for line in normalize_lines(get_lang_path(path)):
		out.append([line[0], fill_text(line[1], vars)])
	return out


## Single lang string for a server-sent lang path, with the vars filled in.
static func lang_text(path, vars) -> String:
	var v = get_lang_path(path)
	if v == null or v is Array or v is Dictionary:
		return ""
	return fill_text(str(v), vars)


func progress_text() -> String:
	if type == QuestType.GETITEMKIND and object2 != null:
		return "%d / %d" % [count, int(object2.count)]
	if object != null:
		return "%d / %d" % [count, int(object.count)]
	return str(count)


## Achievement (achievement.js): [index, type, rank, objectType, objectKind, count, objectCount]
static func achievement_from(arr: Array) -> Dictionary:
	var a: Array = []
	for v in arr:
		a.append(Types.to_int(v))
	while a.size() < 7:
		a.append(0)
	var oc := ItemTypes.short_number(a[6], 0)
	return {
		"index": a[0], "type": a[1], "rank": a[2], "objectType": a[3],
		"objectKind": a[4], "count": a[5], "objectCount": a[6],
		"summary": GameData.tr_lang("ACHIEVEMENTS_%d" % a[0], [oc]),
	}
