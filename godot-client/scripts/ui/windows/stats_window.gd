class_name StatsWindow
extends GameWindow
## Character stats (dialog/statdialog.js + entity/player/playercombat.js):
## levels with progress, stat points (+ buttons) and base combat values.

var data: PlayerData
var actions: ItemActions
var _levels: GridContainer
var _stats_box: VBoxContainer
var _combat: GridContainer


func _init() -> void:
	super._init("PLAYER", Vector2(560, 0))


func build() -> void:
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 24)
	content.add_child(cols)
	_levels = GridContainer.new()
	_levels.columns = 3
	_levels.add_theme_constant_override("h_separation", 14)
	cols.add_child(_levels)
	var right := VBoxContainer.new()
	cols.add_child(right)
	_stats_box = VBoxContainer.new()
	right.add_child(_stats_box)
	right.add_child(HSeparator.new())
	_combat = GridContainer.new()
	_combat.columns = 2
	_combat.add_theme_constant_override("h_separation", 14)
	right.add_child(_combat)


func bind(d: PlayerData, a: ItemActions) -> void:
	data = d
	actions = a
	d.player_info_changed.connect(_refresh_contents)
	d.stats_changed.connect(_refresh_contents)
	d.equipment_changed.connect(_refresh_contents)


func open() -> void:
	super.open()
	actions.client().send([Types.Messages.CW_REQUEST, 2])   # sendPlayerInfo


func refresh() -> void:
	_refresh_contents()


static func _ratio(xp: int, lvl: int, table: Array) -> String:
	if xp == 0 or lvl <= 0 or lvl >= table.size():
		return "0%"
	var lo := float(table[lvl - 1])
	var hi := float(table[lvl])
	return "%d%%" % int((xp - lo) / maxf(1, hi - lo) * 100)


func _refresh_contents() -> void:
	if not visible or world == null:
		return
	var p = world.player
	var xp: Dictionary = p.stats.get("exp", {})
	Types._ensure_tables()
	var skill_tab := PlayerData.skill_exp_table()
	var rows_l: Array = []
	rows_l.append(["Name", p.ename, ""])
	var b := int(xp.get("base", 0))
	rows_l.append(["Level", Types.get_level(b), _ratio(b, Types.get_level(b), Types.exp_for_level)])
	var at := int(xp.get("attack", 0))
	rows_l.append(["Attack Level", Types.get_attack_level(at), _ratio(at, Types.get_attack_level(at), Types.attack_exp)])
	var df := int(xp.get("defense", 0))
	rows_l.append(["Defense Level", Types.get_defense_level(df), _ratio(df, Types.get_defense_level(df), Types.defense_exp)])
	for w in ["sword", "bow", "hammer", "axe"]:
		var wx := int(xp.get(w, 0))
		var wl := Types.get_weapon_level(wx)
		rows_l.append(["%s Level" % w.capitalize(), wl, _ratio(wx, wl, Types.weapon_exp)])
	for w in ["logging", "mining"]:
		var sx := int(xp.get(w, 0))
		var sl := PlayerData.skill_level(sx)
		rows_l.append(["%s Level" % w.capitalize(), sl, _ratio(sx, sl, skill_tab)])
	_fill_grid(_levels, rows_l)
	for c in _stats_box.get_children():
		_stats_box.remove_child(c)
		c.queue_free()
	var free := int(p.stats.get("free", 0))
	_stats_box.add_child(UiStyle.label("Free Points: %d" % free, 14, Color(0.6, 1, 0.6)))
	var rows := [["Attack", "attack", 1], ["Defense", "defense", 2], ["Health", "health", 3], ["Energy", "energy", 0], ["Luck", "luck", 4]]
	for r in rows:
		var h := HBoxContainer.new()
		var l := UiStyle.label("%s: %d" % [r[0], int(p.stats.get(r[1], 0))], 14)
		l.custom_minimum_size = Vector2(150, 0)
		h.add_child(l)
		if free > 0 and int(r[2]) > 0:
			var stat_type: int = r[2]
			h.add_child(UiStyle.button("+", func(): actions.client().send_add_stat(stat_type, 1)))
		_stats_box.add_child(h)
	var dmg := base_damage(p)
	var def := base_damage_def(p)
	_fill_grid(_combat, [["Base Crit", base_crit(p)], ["Base Crit Def", base_crit_def(p)],
		["Base Damage", "%d-%d" % dmg], ["Base Damage Def", "%d-%d" % def]], Color(1, 0.9, 0.6))


func _fill_grid(g: GridContainer, rows_in: Array, col := Color.WHITE) -> void:
	for c in g.get_children():
		g.remove_child(c)
		c.queue_free()
	for r in rows_in:
		for i in range(r.size()):
			g.add_child(UiStyle.label(str(r[i]), 14, col if i == 0 else Color(0.85, 0.95, 1)))


# ------------------------------------------------- playercombat.js formulas

func _weapon_room():
	return data.weapon()


func base_crit(p) -> String:
	var item_diff: int = p.level * 2
	var w = _weapon_room()
	if w != null:
		item_diff = 3 * int(ItemTypes.data(int(w.kind)).get("modifier", 0)) + int(w.number) * 2
	var stat_diff := int(p.stats.get("attack", 0)) + int(p.stats.get("luck", 0)) * 2
	return "%d%%" % int(round(clampi(stat_diff + item_diff, 0, 500) / 5.0))


func base_crit_def(p) -> String:
	var item_diff: int = p.level * 2
	for i in range(4):
		var r = data.equipment[i]
		if r != null:
			item_diff += 3 * int(ItemTypes.data(int(r.kind)).get("modifier", 0)) + int(r.number) * 2
	var stat_diff := int(p.stats.get("defense", 0)) + int(p.stats.get("luck", 0)) * 2
	return "%d%%" % int(round(clampi(stat_diff + item_diff, 0, 500) / 5.0))


func base_damage(p) -> Array:
	var w = _weapon_room()
	var level: int = maxi(1, p.level)
	var dealt := level
	if w != null:
		dealt = int(ItemTypes.data(int(w.kind)).get("modifier", 0)) * 3 + int(w.number) * 2
	var xp: Dictionary = p.stats.get("exp", {})
	var power := Types.get_attack_level(int(xp.get("attack", 0))) / 50.0 + 1
	var wlevel := 0
	if w != null:
		wlevel = Types.get_weapon_level(int(xp.get(ItemTypes.type_of(int(w.kind)), 0)))
	power *= wlevel / 50.0 + 1
	if w != null:
		dealt = int(dealt * ((float(w.dur) / maxf(1, float(w.durMax))) * 0.5 + 0.5))
	dealt += int(p.stats.get("attack", 0)) * 3 + int(p.stats.get("luck", 0))
	var noob := 1 + maxf(0, (12 - level) * (1.0 / level))
	var mn := int(level * power * noob * 4)
	var mx := int(mn * 1.15)
	return [mn + dealt, int((mx + dealt) * 3)]


func base_damage_def(p) -> Array:
	var level: int = p.level + 3
	var dealt := level
	for i in range(4):
		var r = data.equipment[i]
		if r != null:
			var multi := 4 if i == 1 else 2
			var d := int(ItemTypes.data(int(r.kind)).get("modifier", 0)) * multi + int(r.number) * multi
			dealt += int(d * ((float(r.dur) / maxf(1, float(r.durMax))) * 0.5 + 0.5))
	var xp: Dictionary = p.stats.get("exp", {})
	var power := Types.get_defense_level(int(xp.get("defense", 0))) / 50.0 + 1
	var mn := int(level * power)
	var mx := mn * 2
	dealt += int(p.stats.get("defense", 0)) * 4 + int(p.stats.get("luck", 0))
	return [mn + dealt, int((mx + dealt) * 1.75)]
