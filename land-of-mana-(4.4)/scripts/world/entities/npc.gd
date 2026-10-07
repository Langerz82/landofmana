class_name Npc
extends Character
## Port of client/js/entity/npcstatic.js and npcmove.js (type decides which).

var npc_quest_id := 0
var dialogue: Array = []
var dialogue_index := 0
var quest_id := 0
var quest = null


func get_sprite_name() -> String:
	if type == Types.EntityType.NPCMOVE:
		return "npc%d_%d" % [1 + (int(kind / 8) % 4), 1 + (kind % 8)]
	return str(GameData.get_npc(kind).get("uid", ""))


func title() -> String:
	var d := GameData.get_npc(kind)
	return str(d.get("title", d.get("name", d.get("uid", ""))))


func sync_view() -> void:
	# NpcMove sprites are drawn half a tile higher (rendererdrawentities.js)
	draw_offset = Vector2(0, -(TS >> 1)) if type == Types.EntityType.NPCMOVE else Vector2.ZERO
	super.sync_view()
