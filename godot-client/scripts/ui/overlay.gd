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

class_name Overlay
extends Control
## Screen-space overlay drawn on top of the world: entity names, health bars,
## floating combat text and speech bubbles. Equivalent of the
## renderer's HUD container (renderer/rendererdraw{names,bars,hud}.js), drawn
## at screen resolution so text stays crisp at the 3x game zoom.

var KOMIKA: FontFile = UiStyle.world_text_font()   # own copy, see UiStyle
const TS := Constants.G_TILESIZE
const NAME_SIZE := 10       # entity name size at the Normal zoom (x Font size setting)
const NAME_MIN_SIZE := 8    # never smaller than this when zoomed far out
# Guide arrows at the screen edge pointing at off-screen NPCs.
const GUIDE_NEAR_TILES := INF  # plain NPC arrows only for NPCs this close (tiles; INF = any distance on the map)
const GUIDE_MAX_NEAR := 4     # at most this many plain NPC arrows at once (nearest first)
const GUIDE_MARGIN := 40.0    # arrow distance from the screen edge (x UI scale)
# Arrow size by the NPC's distance from the player: full size (x GUIDE_SCALE_CLOSE)
# at GUIDE_CLOSE_TILES or closer, shrinking to x GUIDE_SCALE_FAR at GUIDE_FAR_TILES+.
const GUIDE_CLOSE_TILES := 12.0
const GUIDE_FAR_TILES := 80.0
const GUIDE_SCALE_CLOSE := 1.3
const GUIDE_SCALE_FAR := 0.5
const GUIDE_COLOR := Color(0, 1, 1, 0.85)      # NPC with quests for the player
const GUIDE_QUEST_COLOR := Color("#ffd23f")   # quest done: go back to this NPC
const GUIDE_MOB_COLOR := Color(1, 1, 1, 0.9)   # mob to kill for an active quest (kill / collect items)

# Mobs of one kind within GUIDE_MOB_GROUP_TILES of a group's lead mob share
# one arrow (at the group's middle, labelled "Name xN"); at most
# GUIDE_MOB_MAX_GROUPS arrows per kind, nearest first.
const GUIDE_MOB_GROUP_TILES := 6.0
const GUIDE_MOB_MAX_GROUPS := 3
# Mob arrows stick to the groups they point at (no flipping as mobs wander):
# another group only takes an arrow's place when it's at least
# GUIDE_MOB_SWITCH_RATIO and GUIDE_MOB_SWITCH_TILES closer.
const GUIDE_MOB_SWITCH_RATIO := 0.25
const GUIDE_MOB_SWITCH_TILES := 3.0
# How fast a mob arrow's direction eases toward its target (per second;
# higher = snappier). Frame-rate independent; big turns catch up just as fast.
const GUIDE_MOB_TURN_RATE := 8.0

var _guide_mob_groups: Dictionary = {}   # mob kind -> ids of the lead mobs of the groups shown
var _guide_mob_angle: Dictionary = {}    # "kind:lead id" -> [smoothed direction (radians), ticks msec]

## Overall size of the guide arrows and their name text (1 = normal).
var guide_pointer_scale := 1.25

var world = null


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR   # smooth text at sub-pixel positions (the overlay draws no images)


func _to_screen(p: Vector2) -> Vector2:
	return world.get_canvas_transform() * p


func _draw() -> void:
	if world == null or world.player == null or world.map_status < 2:
		return
	var scale_f: float = world.game_scale
	var view := get_viewport_rect().grow(64)
	var p = world.player
	# (The target marker is drawn under the sprites by World's TargetMarker.)
	if _bars.size() > 0 and Engine.get_process_frames() % 120 == 0:
		for id in _bars.keys():
			if not world.entities.has(id):
				_bars.erase(id)
	for e in world.entities.values():
		if e.hidden_by_area or e.is_dead:
			continue
		var sp := _to_screen(Vector2(e.x, e.y))
		if not view.has_point(sp):
			continue
		if e.is_dying:
			continue   # no name or health bar during the death animation
		_draw_name(e, sp, scale_f)
		if e != p and e is Character:
			_draw_health(e, sp, scale_f)
	if p.start_harvest_time > 0:
		var r := clampf((Time.get_ticks_msec() - p.start_harvest_time) / float(maxi(p.harvest_duration, 1000)), 0, 1)
		_draw_bar(_to_screen(Vector2(p.x, p.y - TS - (TS >> 1))), r, Color(0, 1, 0), scale_f)
	for info in world.infos:
		var ip := _to_screen(Vector2(info.x, info.y - TS))
		var col: Color = info.color
		col.a = clampf(info.opacity, 0, 1)
		var fs := UiStyle.fs(info.size * 3 * UiStyle.ui_scale)
		_text_centered(str(info.text), ip, fs, col, Color(0, 0, 0, col.a), roundi(4 * UiStyle.ui_scale))
	_draw_guides(scale_f)
	for b in world.bubbles.values():
		if is_instance_valid(b.entity):
			_draw_bubble(b, scale_f)


## Guide arrows: at the screen edge, pointing at nearby off-screen NPCs
## (white, the nearest GUIDE_MAX_NEAR within GUIDE_NEAR_TILES) and at any NPC
## the player has to return to for a completed quest (gold, pulsing, at any
## distance on the map). A quest NPC that's on screen gets a bobbing gold
## marker over its name instead. NPCs with quests for the player get cyan
## arrows; the nearest off-screen mob of each kind needed for an unfinished
## kill / collect-items quest gets a white one.
func _draw_guides(s: float) -> void:
	var p = world.player
	var screen := get_viewport_rect()
	var returns: Dictionary = world.quest_return_ids()
	var near_px := float(GUIDE_NEAR_TILES * TS)
	var active := _guide_active_quest_npcs()
	var plain: Array = []
	var quest: Array = []
	for n in world.npcs.values():
		if not is_instance_valid(n) or n.hidden_by_area or n.is_dead:
			continue
		var is_quest: bool = returns.has(n.npc_quest_id)
		var sp := _to_screen(Vector2(n.x, n.y))
		if screen.has_point(sp):
			# On screen: bobbing marker over its name instead of an arrow
			# (gold: quest to hand in; cyan: new quest for us).
			if is_quest:
				_draw_quest_marker(n, sp, s, GUIDE_QUEST_COLOR)
			elif not world.npc_no_quests.has(n.npc_quest_id) and not active.has(n.npc_quest_id):
				_draw_quest_marker(n, sp, s, Color(GUIDE_COLOR, 1.0))
			continue
		var dist := Vector2(n.x - p.x, n.y - p.y).length()
		if is_quest:
			quest.append([n, sp, dist])
			continue
		if world.npc_no_quests.has(n.npc_quest_id):
			continue   # nothing more for us there (no more quests): no arrow
		if active.has(n.npc_quest_id):
			continue   # their quest is already under way: no arrow until it's done
		if dist <= near_px:
			plain.append([dist, n, sp])
	plain.sort_custom(func(a, b): return a[0] < b[0])
	for i in range(mini(plain.size(), GUIDE_MAX_NEAR)):
		_draw_edge_arrow(plain[i][2], str(plain[i][1].ename), GUIDE_COLOR, false, plain[i][0])
	for q in quest:
		_draw_edge_arrow(q[1], str(q[0].ename), GUIDE_QUEST_COLOR, true, q[2])
	# Off-screen mobs of each quest-target kind, in groups: mobs within
	# GUIDE_MOB_GROUP_TILES of a group's lead share one arrow. Groups shown
	# last frame are formed first around the same lead, so they keep their
	# identity, and keep their arrow unless another group is clearly closer
	# (GUIDE_MOB_SWITCH_*).
	var kinds := _guide_mob_kinds()
	var cands: Dictionary = {}   # kind -> [[mob, dist], ...]
	for e in world.entities.values():
		if kinds.is_empty():
			break
		if not is_instance_valid(e) or not (e is Mob) or e.hidden_by_area or e.is_dead or e.is_dying:
			continue
		var k := int(e.kind)
		if not kinds.has(k):
			continue
		var sp := _to_screen(Vector2(e.x, e.y))
		if screen.has_point(sp):
			_draw_quest_marker(e, sp, s, Color(GUIDE_MOB_COLOR, 1.0))   # on screen: white marker over it
			continue
		if not cands.has(k):
			cands[k] = []
		cands[k].append([e, Vector2(e.x - p.x, e.y - p.y).length()])
	var group_px := GUIDE_MOB_GROUP_TILES * TS
	var groups: Array = []   # [kind, lead, member count, world centre, dist]
	for k in cands:
		var prev: Array = _guide_mob_groups.get(k, [])
		var list: Array = cands[k]
		list.sort_custom(func(a, b):
			var pa: bool = prev.has(a[0].id)
			var pb: bool = prev.has(b[0].id)
			if pa != pb:
				return pa
			return a[1] < b[1])
		var used: Dictionary = {}
		var kind_groups: Array = []   # [rank, kind, lead, count, centre, dist]
		for c_lead in list:
			var lead = c_lead[0]
			if used.has(lead.id):
				continue
			var sum := Vector2.ZERO
			var count := 0
			for c in list:
				var e = c[0]
				if used.has(e.id) or Vector2(e.x - lead.x, e.y - lead.y).length() > group_px:
					continue
				used[e.id] = true
				sum += Vector2(e.x, e.y)
				count += 1
			var centre := sum / count
			var dist := Vector2(centre.x - p.x, centre.y - p.y).length()
			# A group already shown ranks as if this much closer.
			var rank := dist - maxf(dist * GUIDE_MOB_SWITCH_RATIO, GUIDE_MOB_SWITCH_TILES * TS) if prev.has(lead.id) else dist
			kind_groups.append([rank, k, lead, count, centre, dist])
		kind_groups.sort_custom(func(a, b): return a[0] < b[0])
		var leads: Array = []
		for i in range(mini(kind_groups.size(), GUIDE_MOB_MAX_GROUPS)):
			var g: Array = kind_groups[i]
			leads.append(g[2].id)
			groups.append(g.slice(1))
		_guide_mob_groups[k] = leads
	# Forget the groups / smoothed directions of kinds no longer needed.
	for k in _guide_mob_groups.keys():
		if not cands.has(k):
			_guide_mob_groups.erase(k)
	var keep: Dictionary = {}
	for g in groups:
		keep["%d:%d" % [g[0], g[1].id]] = true
	for key in _guide_mob_angle.keys():
		if not keep.has(key):
			_guide_mob_angle.erase(key)
	for g in groups:
		var label := _mob_name(int(g[0]))
		if g[2] > 1:
			label += " x%d" % g[2]
		_draw_edge_arrow(_to_screen(g[3]), label, GUIDE_MOB_COLOR, false, g[4], "%d:%d" % [g[0], g[1].id])


## npc_quest_ids of the NPCs whose quest the player has accepted and not finished.
func _guide_active_quest_npcs() -> Dictionary:
	var ids := {}
	if world.data == null:
		return ids
	for q in world.data.quests.values():
		if q.status != Quest.Status.COMPLETE:
			ids[q.npc_quest_id] = true
	return ids


## Mob kinds the player has to kill for an unfinished quest: the target of a
## kill-mob-kind quest, or the mob dropping a collect-items quest's items.
func _guide_mob_kinds() -> Dictionary:
	var kinds := {}
	if world.data == null:
		return kinds
	for q in world.data.quests.values():
		if q.status == Quest.Status.COMPLETE or q.object == null:
			continue
		if q.type == Quest.QuestType.KILLMOBKIND:
			if int(q.object.count) > 0 and q.count < int(q.object.count):
				kinds[int(q.object.kind)] = true
		elif q.type == Quest.QuestType.GETITEMKIND:
			if q.object2 != null and int(q.object2.count) > 0 and q.count < int(q.object2.count):
				kinds[int(q.object.kind)] = true
	return kinds


func _mob_name(kind: int) -> String:
	var mob := GameData.get_mob(kind)
	if mob.is_empty():
		return ""
	var n := str(mob.get("name", mob.get("key", "")))
	return n.substr(0, 1).to_upper() + n.substr(1)


## Arrow size multiplier for an NPC `dist` world pixels from the player:
## bigger the closer it is.
static func guide_scale(dist: float) -> float:
	var t := clampf((dist / TS - GUIDE_CLOSE_TILES) / (GUIDE_FAR_TILES - GUIDE_CLOSE_TILES), 0.0, 1.0)
	return lerpf(GUIDE_SCALE_CLOSE, GUIDE_SCALE_FAR, t)


## Arrow on the screen edge, on the line from the screen centre to `target`
## (an off-screen point), pointing at it, with `label` just inside it. The
## arrow is bigger the closer the NPC is (`dist`, world pixels; guide_scale()).
## With `smooth_key` (a mob group), the arrow's direction eases toward the
## target over a few frames (GUIDE_MOB_TURN_RATE) instead of snapping, so
## jittery or switching targets slide rather than jump.
func _draw_edge_arrow(target: Vector2, label: String, color: Color, pulse: bool, dist: float, smooth_key = null) -> void:
	var u := UiStyle.ui_scale
	var ps := guide_pointer_scale
	var screen := get_viewport_rect()
	var c := screen.get_center()
	var dir := target - c
	if dir.length_squared() < 1.0:
		return
	if smooth_key != null:
		var now := Time.get_ticks_msec()
		var goal := dir.angle()
		var a := goal
		if _guide_mob_angle.has(smooth_key):
			var prev: Array = _guide_mob_angle[smooth_key]
			var dt := clampf((now - int(prev[1])) / 1000.0, 0.0, 0.25)
			a = float(prev[0]) + angle_difference(float(prev[0]), goal) * (1.0 - exp(-GUIDE_MOB_TURN_RATE * dt))
		_guide_mob_angle[smooth_key] = [a, now]
		dir = Vector2.from_angle(a) * dir.length()
	var m := GUIDE_MARGIN * u
	var hw := maxf(screen.size.x / 2 - m, 1.0)
	var hh := maxf(screen.size.y / 2 - m, 1.0)
	var pos := c + dir * minf(hw / maxf(absf(dir.x), 0.001), hh / maxf(absf(dir.y), 0.001))
	var n := dir.normalized()
	var side := n.orthogonal()
	var size := (15.0 if pulse else 11.0) * u * ps * guide_scale(dist)
	if pulse:
		size *= 1.0 + 0.15 * sin(Time.get_ticks_msec() / 150.0)
	var tip := pos + n * size
	var pts := PackedVector2Array([tip, pos - n * size * 0.7 + side * size * 0.85,
		pos - n * size * 0.3, pos - n * size * 0.7 - side * size * 0.85])
	draw_colored_polygon(pts, color)
	pts.append(tip)
	draw_polyline(pts, Color(0, 0, 0, color.a), maxf(1.5, 2.0 * u * ps), true)
	if label == "":
		return
	# Name just inside the arrow, kept fully on screen.
	var fs := maxi(roundi(NAME_MIN_SIZE * minf(ps, 1.0)), roundi(UiStyle.fs(9) * u * ps))
	var w := KOMIKA.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var lp := pos - n * (size + fs)
	lp.x = clampf(lp.x, w / 2 + 4 * u, screen.size.x - w / 2 - 4 * u)
	lp.y = clampf(lp.y, fs + 4 * u, screen.size.y - fs * 0.5 - 4 * u)
	_text_centered(label, lp, fs, color, Color(0, 0, 0, color.a), maxi(1, roundi(3 * u * ps)))


## Bobbing arrow over the name of an on-screen NPC / mob the guide arrows would
## otherwise point at (gold: quest to hand in; cyan: new quest; white: quest mob).
func _draw_quest_marker(e, sp: Vector2, s: float, color: Color = GUIDE_QUEST_COLOR) -> void:
	var u := UiStyle.ui_scale
	var y := sp.y - TS * s - name_size() * 1.2
	if e.type == Types.EntityType.NPCMOVE:
		y -= (TS >> 1) * s
	y += sin(Time.get_ticks_msec() / 180.0) * 3.0 * u
	var w := 7.0 * u
	var h := 9.0 * u
	var pts := PackedVector2Array([Vector2(sp.x, y), Vector2(sp.x - w, y - h), Vector2(sp.x + w, y - h)])
	draw_colored_polygon(pts, color)
	pts.append(pts[0])
	draw_polyline(pts, Color.BLACK, maxf(1.5, 2.0 * u), true)


func _draw_name(e, sp: Vector2, s: float) -> void:
	var text := ""
	var color := Color.WHITE
	if e is Player:
		text = e.ename
		color = Color(1, 1, 0) if e == world.player else (Color(1, 0, 0) if e.admin else Color("#fcda5c"))
	elif e is Mob:
		text = "Level %d" % e.level
		color = Color("#FF3333") if e.is_aggressive else Color(1, 1, 0)
	elif e is Npc:
		text = e.ename
		# Same colour as the NPC's guide arrow: gold = go back to it (quest
		# reward / hand-in), cyan = new quest, white = quest in progress or
		# nothing more for us.
		match world.npc_guide_state(e):
			"return":
				color = GUIDE_QUEST_COLOR
			"available":
				color = Color(GUIDE_COLOR, 1.0)
			_:
				color = Color.WHITE
	elif e is ItemEntity:
		text = e.display_name()
	if text == "":
		return
	var y_off := -TS * s
	if e is Npc and e.type == Types.EntityType.NPCMOVE:
		y_off -= (TS >> 1) * s
	_text_centered(text, sp + Vector2(0, y_off), name_size(), color, Color.BLACK, clampi(roundi(4 * world.zoom_factor() * UiStyle.ui_scale), 2, roundi(8 * maxf(1.0, UiStyle.ui_scale))))


## Entity name font size: grows / shrinks with the Zoom setting, in
## proportion to the sprites it labels (NAME_SIZE at the Normal zoom), and
## with Settings -> UI scale like all other game text.
func name_size() -> int:
	return maxi(NAME_MIN_SIZE, roundi(UiStyle.fs(NAME_SIZE) * world.zoom_factor() * UiStyle.ui_scale))


func _draw_health(e, sp: Vector2, s: float) -> void:
	var hp_max := int(e.stats.get("hpMax", 0))
	if hp_max <= 0:
		_bars.erase(e.id)
		return
	var hp := int(e.stats.get("hp", 0))
	var ratio := _smooth_ratio(e.id, clampf(float(hp) / hp_max, 0, 1))
	# Hidden at full health, but only once the slide back up has finished.
	if hp >= hp_max and ratio >= 0.999:
		return
	_draw_bar(sp + Vector2(0, -(TS + (TS >> 1)) * s), ratio, Color(1, 0, 0), s)


## Overhead bars slide to a new value over SmoothBar.duration_ms() (ease out),
## like the HUD bars. Per entity: {from, to, start}.
var _bars: Dictionary = {}


func _smooth_ratio(id: int, to: float) -> float:
	var now := Time.get_ticks_msec()
	var ms := SmoothBar.duration_ms()
	var b = _bars.get(id)
	if b == null or ms <= 0:
		_bars[id] = {"from": to, "to": to, "start": now}
		return to
	var cur := _eval(b, now, ms)
	if not is_equal_approx(to, b.to):
		b.from = cur
		b.to = to
		b.start = now
		cur = b.from
	return cur


static func _eval(b: Dictionary, now: int, ms: int) -> float:
	var t := clampf(float(now - int(b.start)) / ms, 0, 1)
	t = sin(t * PI / 2)   # ease out, same curve as the HUD tween
	return lerpf(float(b.from), float(b.to), t)


func _draw_bar(center: Vector2, ratio: float, color: Color, s: float) -> void:
	var w := TS * s
	var h := (TS >> 2) * s
	var r := Rect2(center - Vector2(w / 2, h / 2), Vector2(w, h))
	draw_rect(r, Color(0, 0, 0, 0.6))
	draw_rect(Rect2(r.position + Vector2(1, 1), Vector2((w - 2) * clampf(ratio, 0, 1), h - 2)), Color(color, 0.8))
	draw_rect(r, Color.BLACK, false, 2.0)


func _text_centered(text: String, pos: Vector2, size: int, color: Color, outline: Color, outline_px := 4) -> void:
	var width := KOMIKA.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var at := pos - Vector2(width / 2.0, -size / 3.0)
	# Real font outline. Drawing the text 16 times in a ring instead gave a
	# lumpy outline, worse while the text fades. The outline size is its full
	# width, so x2 keeps the old thickness (old ring radius = outline_px / 2).
	draw_string_outline(KOMIKA, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, outline_px * 2, outline)
	draw_string(KOMIKA, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)


func _draw_bubble(b: Dictionary, s: float) -> void:
	var e = b.entity
	var text := str(b.text)
	var u := UiStyle.ui_scale   # Settings -> UI scale: the whole bubble grows with it
	var font_size := UiStyle.fs(12 * u)
	var max_w := 260.0 * u
	var lines := _wrap(text, max_w, font_size)
	var line_h := font_size + 4 * u
	var w := 0.0
	for l in lines:
		w = maxf(w, KOMIKA.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x)
	w += 20 * u
	var h := lines.size() * line_h + 12 * u
	var y_extra := (TS >> 1) * s if (e is Npc and e.type == Types.EntityType.NPCMOVE) else 0.0
	var anchor := _to_screen(Vector2(e.x, e.y)) - Vector2(0, TS * 1.6 * s + y_extra)
	var rect := Rect2(anchor - Vector2(w / 2, h), Vector2(w, h))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.9)
	sb.border_color = Color.BLACK
	sb.set_border_width_all(maxi(1, roundi(2 * u)))
	sb.set_corner_radius_all(roundi(10 * u))
	draw_style_box(sb, rect)
	var tail := PackedVector2Array([anchor + Vector2(-6, -1) * u, anchor + Vector2(6, -1) * u, anchor + Vector2(0, 8) * u])
	draw_colored_polygon(tail, Color(1, 1, 1, 0.9))
	var y := rect.position.y + 6 * u + font_size
	for l in lines:
		var lw := KOMIKA.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		draw_string(KOMIKA, Vector2(anchor.x - lw / 2, y), l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color.BLACK)
		y += line_h


func _wrap(text: String, max_w: float, size: int) -> Array:
	var out: Array = []
	var cur := ""
	for word in text.split(" "):
		var cand := word if cur == "" else cur + " " + word
		if KOMIKA.get_string_size(cand, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x > max_w and cur != "":
			out.append(cur)
			cur = word
		else:
			cur = cand
	if cur != "":
		out.append(cur)
	return out
