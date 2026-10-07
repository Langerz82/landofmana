extends "res://tests/npc_dialogue_test.gd"
## Talk to the Old Man after his quest is complete: first the reward lines
## (QUESTS_REWARD), then "no more quests, head <dir> and look for <npc>"
## (QUESTS_NONE). Prepare a logged-out character first, e.g.
##   redis-cli hset p:Npcdlg2 completeQuests '{"200000":{"npcid":1000036,"reward":1},"200001":{"npcid":1000036}}' newquests '[]'
## Run: godot res://tests/npc_noquest_test.tscn -- --user=npcdlg2 --pass=secret1


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	var p: Player = world.player
	await until(func(): return old_man() != null, 5000)
	var npc = old_man()
	await wait(800)
	for round_i in range(2):
		await wait(5500)
		var lines: Array = []
		var seen := {}
		await mouse_click(world_to_screen(npc.x, npc.y))
		var started := await until(func(): return p.dialogue_entity == npc, 8000)
		check("talk round %d starts dialogue" % round_i, started)
		await shot("noquest_%d" % round_i)
		var guard := 0
		while p.dialogue_entity == npc and guard < 40:
			guard += 1
			var t: String = hud._dialogue_text.text
			if hud._dialogue_panel.visible and not seen.has(t):
				seen[t] = true
				lines.append(hud._dialogue_name.text + ": " + t)
			await press_space()
			await wait(300)
		print("  round %d lines: %s" % [round_i, lines])
		if round_i == 1:
			check("no-more-quests message", lines.any(func(l): return "no more quests" in l), str(lines))
	_report()
