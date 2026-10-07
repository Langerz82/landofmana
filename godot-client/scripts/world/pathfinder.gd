class_name Pathfinder
extends RefCounted
## Replacement for client/js/pathfinder.js + game.findPath(). Uses Godot's
## AStarGrid2D on a cropped window around start/end (like the JS short-grid
## search) and falls back to progressively bigger windows. The resulting
## path uses the same pixel waypoint format the server validates:
## axis-aligned segments, tile centres, first = start, last = end, <= 16 nodes.

const TS := Types.G_TILESIZE
const MAX_NODES := 16

var map: MapData


func _init(m: MapData) -> void:
	map = m


func find_path(sx: int, sy: int, ex: int, ey: int) -> Array:
	if map == null or not map.loaded:
		return []
	if map.is_colliding(sx, sy):
		return []
	if map.is_colliding_point(ex, ey):
		return []
	var s := Vector2i(floori(sx / float(TS)), floori(sy / float(TS)))
	var e := Vector2i(floori(ex / float(TS)), floori(ey / float(TS)))
	if map.is_out_of_bounds(s.x, s.y) or map.is_out_of_bounds(e.x, e.y):
		return []
	var span := maxi(absi(s.x - e.x), absi(s.y - e.y))
	var grid_path: Array = []
	for margin in [maxi(3, span), maxi(16, span * 2), 64]:
		var res := _search(s, e, margin)
		if not res.is_empty():
			grid_path = res
			break
	if grid_path.is_empty():
		return []
	var real: Array = []
	for n in grid_path:
		real.append([(n.x + 0.5) * TS, (n.y + 0.5) * TS])
	real[0] = [sx, sy]
	real[real.size() - 1] = [ex, ey]
	if real.size() == 1:
		real.append([ex, ey])
	real = _fix_diagonal_jumps(real)
	real = drop_unneeded_nodes(real)
	for n in real:
		n[0] = int(n[0])
		n[1] = int(n[1])
	if real.size() > MAX_NODES:
		real = real.slice(0, MAX_NODES)
	if not is_valid_path(real):
		return []
	return real


func _search(s: Vector2i, e: Vector2i, margin: int) -> Array:
	var x0 := maxi(0, mini(s.x, e.x) - margin)
	var y0 := maxi(0, mini(s.y, e.y) - margin)
	var x1 := mini(map.width - 1, maxi(s.x, e.x) + margin)
	var y1 := mini(map.height - 1, maxi(s.y, e.y) + margin)
	var astar := AStarGrid2D.new()
	astar.region = Rect2i(x0, y0, x1 - x0 + 1, y1 - y0 + 1)
	astar.cell_size = Vector2(1, 1)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	astar.default_compute_heuristic = AStarGrid2D.HEURISTIC_MANHATTAN
	astar.default_estimate_heuristic = AStarGrid2D.HEURISTIC_MANHATTAN
	astar.update()
	var w := map.width
	for gy in range(y0, y1 + 1):
		var row := gy * w
		for gx in range(x0, x1 + 1):
			if map.collision[row + gx] == 1:
				astar.set_point_solid(Vector2i(gx, gy), true)
	# the start cell may be marked solid when standing on an edge
	astar.set_point_solid(s, false)
	var ids := astar.get_id_path(s, e)
	return Array(ids)


func _fix_diagonal_jumps(p: Array) -> Array:
	var fixed: Array = [p[0]]
	for i in range(1, p.size()):
		var prev = fixed[fixed.size() - 1]
		var curr = p[i]
		if prev[0] != curr[0] and prev[1] != curr[1]:
			fixed.append([curr[0], prev[1]])
		fixed.append(curr)
	return fixed


func drop_unneeded_nodes(p: Array) -> Array:
	if p.size() < 2:
		return p
	var result: Array = [p[0]]
	for i in range(1, p.size()):
		var curr = p[i]
		var prev = result[result.size() - 1]
		if curr[0] == prev[0] and curr[1] == prev[1]:
			continue
		result.append(curr)
		while result.size() >= 3:
			var a = result[result.size() - 3]
			var b = result[result.size() - 2]
			var c = result[result.size() - 1]
			if (a[0] == b[0] and b[0] == c[0]) or (a[1] == b[1] and b[1] == c[1]):
				result.remove_at(result.size() - 2)
			else:
				break
	return result


static func is_valid_path(p: Array) -> bool:
	if p.size() < 2:
		return false
	var prev = null
	for n in p:
		if prev != null:
			if prev[0] == n[0] and prev[1] == n[1]:
				return false
			if prev[0] != n[0] and prev[1] != n[1]:
				return false
		prev = n
	return true
