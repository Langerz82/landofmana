extends "res://tests/play_test.gd"
## Talk to the Old Man NPC (quest dialogue), then walk through the door to
## map0 and back. Run like play_test.tscn.

var npc_seen := false
var dialogue_lines := 0
var maps_visited: Array = []
var load_started := 0


func _process(_d: float) -> void:
	if world == null:
		return
	if world.map_status < 2 or not world.started:
		return
	var p := world.player
	var now := Time.get_ticks_msec()
	if not maps_visited.has(world.map_index):
		maps_visited.append(world.map_index)
		print("now on map ", world.map_index, " at ", p.x, ",", p.y)
	match phase:
		0:
			var npc = null
			for e in world.npcs.values():
				npc = e
			if npc == null:
				return
			print("NPC ", npc.ename, " id=", npc.id, " at ", npc.x, ",", npc.y, " questId=", npc.npc_quest_id)
			world.click(npc.x, npc.y)
			t0 = now
			phase = 1
		1:
			if p.dialogue_entity != null and dialogue_lines == 0:
				dialogue_lines = p.dialogue_entity.dialogue.size()
				print("dialogue started: ", dialogue_lines, " lines; first: ", p.dialogue_entity.dialogue[0])
				_shot("04_dialogue")
			if dialogue_lines > 0:
				# advance quickly with Space (tryShowDialogue)
				if now - t0 > 400:
					t0 = now
					world.make_player_interact_next_to()
				if p.dialogue_entity == null:
					print("dialogue finished; quests=", world.quests.keys())
					t0 = now
					phase = 2
			elif now - t0 > 6000:
				print("no dialogue received (pos ", p.x, ",", p.y, ")")
				phase = 2
		2:
			if p.dialogue_entity != null:
				if now - t0 > 400:
					t0 = now
					world.make_player_interact_next_to()
				return
			if now - t0 > 1000:
				var door = null
				for d in world.current_map.doors:
					if d.tmap == 0:
						door = d
				print("walking to door ", door)
				var r: Rect2i = door.rect
				world.click(r.position.x + 8, r.position.y + 8)
				print("path: ", p.move_path)
				t0 = now
				phase = 3
		3:
			if world.map_index == 0:
				print("teleported to map0 at ", p.x, ",", p.y, " after ", now - t0, "ms")
				_shot("05_map0")
				t0 = now
				phase = 4
			elif now - t0 > 8000:
				_fail("did not reach door; pos %d,%d path %s" % [p.x, p.y, str(p.move_path)])
		4:
			if now - t0 > 1500:
				var door = world.current_map.doors[0]
				var r: Rect2i = door.rect
				print("map0 door ", door, " player at ", p.x, ",", p.y)
				world.click(r.position.x + 8, r.position.y + 8)
				print("path: ", p.move_path)
				t0 = now
				phase = 5
		5:
			if world.map_index == 1 and now - t0 > 200:
				print("back on map1 at ", p.x, ",", p.y, " entities=", world.entities.size())
				_shot("06_back")
				print("SCENARIO DONE maps=", maps_visited)
				get_tree().quit(0)
			elif now - t0 > 10000:
				_fail("did not return; pos %d,%d path %s" % [p.x, p.y, str(p.move_path)])
