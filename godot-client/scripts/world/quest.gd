class_name Quest
extends RefCounted
## Port of client/js/quest.js and achievement.js (data + text templates).

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


static func from_array(arr: Array) -> Quest:
	var q := Quest.new()
	q.update(arr)
	return q


func update(arr: Array) -> void:
	var a: Array = []
	for v in arr:
		a.append(Types.to_int(v))
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
	_set_desc()


func _set_desc() -> void:
	var quests_lang: Dictionary = GameData.lang.get("QUESTS", {})
	var d = null
	var summary_index := ""
	var ql = quests_lang.get(str(id))
	if ql is Array:
		if ql.size() > status + 1:
			d = ql[status + 1]
	var quest_type := ""
	match type:
		QuestType.HIDEANDSEEK:
			quest_type = "QUESTS_FIND"
			summary_index = "HIDEANDSEEK"
		QuestType.KILLMOBKIND:
			quest_type = "QUESTS_MOB"
			summary_index = "KILLMOBKIND"
		QuestType.GETITEMKIND:
			quest_type = "QUESTS_ITEM"
			summary_index = "GETITEMKIND"
		QuestType.USENODE:
			quest_type = "QUESTS_NODE"
			summary_index = "USENODE"
	if d == null and quest_type != "":
		var ld = GameData.lang.get(quest_type)
		if ld is Array and not ld.is_empty() and ld[0] is Array and ld[0].size() > status:
			d = ld[0][status]
	desc = []
	if d != null:
		if not (d is Array):
			d = [[0, d]]
		for line in d:
			if line is Array:
				desc.append([int(line[0]), text_template(str(line[1]))] + (line.slice(2) if line.size() > 2 else []))
			else:
				desc.append([0, text_template(str(line))])
	var sums: Dictionary = GameData.lang.get("QUEST_SUMMARY", {})
	var s = sums.get(str(id), sums.get(summary_index, ""))
	summary = text_template(str(s))


func text_template(txt: String) -> String:
	match type:
		QuestType.GETITEMKIND:
			if object2 != null:
				var loot := GameData.get_loot(1000 + int(object2.kind))
				if loot.is_empty():
					loot = GameData.get_loot(int(object2.kind))
				txt = txt.replace("%name%", _cap(str(loot.get("name", ""))))
				txt = txt.replace("%count%", str(object2.count))
			if object != null:
				var mob := GameData.get_mob(int(object.kind))
				if not mob.is_empty():
					txt = txt.replace("%name2%", _cap(str(mob.key)))
		QuestType.KILLMOBKIND:
			if object != null:
				var mob := GameData.get_mob(int(object.kind))
				txt = txt.replace("%name%", _cap(str(mob.get("key", ""))))
				txt = txt.replace("%count%", str(object.count))
		QuestType.HIDEANDSEEK:
			if object != null:
				txt = txt.replace("%name%", str(GameData.get_npc(int(object.kind)).get("name", "")))
		QuestType.USENODE:
			if object != null:
				txt = txt.replace("%count%", str(object.count))
	return txt.replace("%count2%", str(count))


static func _cap(t: String) -> String:
	return t if t == "" else t[0].to_upper() + t.substr(1)


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
