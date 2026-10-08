class_name Pathfinder
extends RefCounted
## Replacement for client/js/pathfinder.js + game.findPath(). Port of the
## gameserver's lib/astar.js: an A* over (tile, direction-of-travel) states that
## minimises direction changes first (see turn_cost), then distance, run on a
## cropped window around start/end (like the JS short-grid search) and falling
## back to progressively bigger windows.
##
## Start and end are exact pixel positions, not snapped to tile centres. The
## resulting path uses the pixel waypoint format the server validates:
## axis-aligned segments, first = start, last = end, turn nodes only,
## <= 16 nodes. The first segment stays on the start's own row/column line,
## the last on the end's, and any segments in between run along tile centres.

const TS := Types.G_TILESIZE
const MAX_NODES := 16
## Extra cost (in tiles) per direction change. 1000 = fewest turns first, then
## shortest (same default as gameserver lib/astar.js). Something like 3-5
## accepts the odd extra turn for noticeably shorter paths.
const DEFAULT_TURN_COST := 1000
## Directions: 0 = +x, 1 = -x, 2 = +y, 3 = -y. d ^ 1 reverses, d < 2 is horizontal.
const DX: Array[int] = [1, -1, 0, 0]
const DY: Array[int] = [0, 0, 1, -1]
const INF := 0x3fffffff

var map: MapData
var turn_cost: int = DEFAULT_TURN_COST
## Extra solid tiles for one search (tile index y * map.width + x -> true),
## e.g. tiles taken by mobs, NPCs and other players. The goal tile is exempt.
var blocked: Dictionary = {}

# Search state (node pool + open-list heap), reset at the start of each search.
var _nx := PackedInt32Array()
var _ny := PackedInt32Array()
var _nd := PackedInt32Array()
var _ng := PackedInt32Array()
var _nf := PackedInt32Array()
var _np := PackedInt32Array()
var _heap := PackedInt32Array()


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
	var segs = null
	for margin in [maxi(3, span), maxi(16, span * 2), 64]:
		segs = _search(s, e, margin)
		if segs != null:
			break
	if segs == null:
		return []
	var real := _to_pixel_path(segs, sx, sy, ex, ey)
	if real.size() == 1:
		real.append([ex, ey])
	if real.size() > MAX_NODES:
		real = real.slice(0, MAX_NODES)
	if not is_valid_path(real):
		return []
	return real


# Tile-level A* inside the cropped window. Returns the path as straight
# segments ([{d, x, y}], x/y = the segment's first tile) or null if unreachable.
func _search(s: Vector2i, e: Vector2i, margin: int) -> Variant:
	var x0 := maxi(0, mini(s.x, e.x) - margin)
	var y0 := maxi(0, mini(s.y, e.y) - margin)
	var x1 := mini(map.width - 1, maxi(s.x, e.x) + margin)
	var y1 := mini(map.height - 1, maxi(s.y, e.y) + margin)
	var cw := x1 - x0 + 1
	var w := map.width
	var collision := map.collision

	var best := PackedInt32Array()
	best.resize(cw * (y1 - y0 + 1) * 4)
	best.fill(INF)
	_nx.clear()
	_ny.clear()
	_nd.clear()
	_ng.clear()
	_nf.clear()
	_np.clear()
	_heap.clear()

	# The start cell may be marked solid (standing on an edge); only the cells
	# moved into are checked.
	var hx0 := e.x - s.x
	var hy0 := e.y - s.y
	_add_node(s.x, s.y, -1, 0,
		absi(hx0) + absi(hy0) + turn_cost * _min_turns(-1, hx0, hy0), -1)

	while _heap.size() > 0:
		var i := _heap_pop()
		var x := _nx[i]
		var y := _ny[i]
		var d := _nd[i]
		var g := _ng[i]
		# Stale entry: a cheaper way into this state was found after queueing.
		if d >= 0 and g > best[((y - y0) * cw + (x - x0)) * 4 + d]:
			continue
		if x == e.x and y == e.y:
			return _to_segments(i)

		for nd in 4:
			# Never reverse straight back onto the previous tile.
			if d >= 0 and nd == (d ^ 1):
				continue
			var tx := x + DX[nd]
			var ty := y + DY[nd]
			if tx < x0 or tx > x1 or ty < y0 or ty > y1:
				continue
			if collision[ty * w + tx] == 1:
				continue
			if not blocked.is_empty() and blocked.has(ty * w + tx) and not (tx == e.x and ty == e.y):
				continue
			var ng := g + 1
			if d >= 0 and nd != d:
				ng += turn_cost
			var si := ((ty - y0) * cw + (tx - x0)) * 4 + nd
			if ng >= best[si]:
				continue
			best[si] = ng
			var hx := e.x - tx
			var hy := e.y - ty
			_add_node(tx, ty, nd, ng,
				ng + absi(hx) + absi(hy) + turn_cost * _min_turns(nd, hx, hy), i)
	return null


# Lower bound on direction changes still needed to reach a tile (dx, dy) away
# when travelling in direction d (-1 = not moving yet).
static func _min_turns(d: int, dx: int, dy: int) -> int:
	if d < 0:
		return 1 if dx != 0 and dy != 0 else 0
	var along: int
	var across: int
	if d < 2:
		along = dx if d == 0 else -dx
		across = dy
	else:
		along = dy if d == 2 else -dy
		across = dx
	if across == 0:
		return 0 if along >= 0 else 2
	return 1 if along >= 0 else 2


func _to_segments(goal: int) -> Array:
	var chain: Array[int] = []
	var i := goal
	while i >= 0:
		chain.append(i)
		i = _np[i]
	chain.reverse()
	var segs: Array = []
	for k in range(1, chain.size()):
		var n := chain[k]
		if segs.is_empty() or segs[segs.size() - 1].d != _nd[n]:
			segs.append({"d": _nd[n], "x": _nx[n], "y": _ny[n]})
	return segs


# Turn tile segments into pixel waypoints. Each segment is a line at a fixed
# coordinate (its "lane"): y for horizontal segments, x for vertical ones.
func _to_pixel_path(segs: Array, sx: int, sy: int, ex: int, ey: int) -> Array:
	var k_count := segs.size()

	# Same tile: at most one turn, anywhere inside the tile is fine.
	if k_count == 0:
		if sx == ex and sy == ey:
			return [[sx, sy]]
		if sx == ex or sy == ey:
			return [[sx, sy], [ex, ey]]
		return [[sx, sy], [ex, sy], [ex, ey]]

	# One straight run of tiles. If start and end aren't on exactly the same
	# line, finish with a small sidestep inside the end tile.
	if k_count == 1:
		var horizontal: bool = segs[0].d < 2
		if (sy == ey) if horizontal else (sx == ex):
			return [[sx, sy], [ex, ey]]
		return [[sx, sy], [ex, sy] if horizontal else [sx, ey], [ex, ey]]

	var path: Array = [[sx, sy]]
	for k in range(k_count - 1):
		# A corner sits where a horizontal lane meets a vertical one.
		var a := _lane(segs, k, sx, sy, ex, ey)
		var b := _lane(segs, k + 1, sx, sy, ex, ey)
		path.append([b, a] if segs[k].d < 2 else [a, b])
	path.append([ex, ey])
	return path


func _lane(segs: Array, k: int, sx: int, sy: int, ex: int, ey: int) -> int:
	var seg: Dictionary = segs[k]
	var horizontal: bool = seg.d < 2
	if k == 0:
		return sy if horizontal else sx
	if k == segs.size() - 1:
		return ey if horizontal else ex
	return (seg.y if horizontal else seg.x) * TS + (TS >> 1)


func _add_node(x: int, y: int, d: int, g: int, f: int, p: int) -> void:
	var i := _nx.size()
	_nx.append(x)
	_ny.append(y)
	_nd.append(d)
	_ng.append(g)
	_nf.append(f)
	_np.append(p)
	_heap_push(i)


# Min-heap on f; ties prefer the larger g (deeper node) so the search heads
# straight for the goal instead of fanning out sideways.
func _less(a: int, b: int) -> bool:
	return _nf[a] < _nf[b] or (_nf[a] == _nf[b] and _ng[a] > _ng[b])


func _heap_push(n: int) -> void:
	_heap.append(n)
	var i := _heap.size() - 1
	while i > 0:
		var parent := (i - 1) >> 1
		if not _less(_heap[i], _heap[parent]):
			break
		var tmp := _heap[parent]
		_heap[parent] = _heap[i]
		_heap[i] = tmp
		i = parent


func _heap_pop() -> int:
	var top := _heap[0]
	var last := _heap[_heap.size() - 1]
	_heap.resize(_heap.size() - 1)
	var n := _heap.size()
	if n > 0:
		_heap[0] = last
		var i := 0
		while true:
			var l := i * 2 + 1
			var r := l + 1
			var smallest := i
			if l < n and _less(_heap[l], _heap[smallest]):
				smallest = l
			if r < n and _less(_heap[r], _heap[smallest]):
				smallest = r
			if smallest == i:
				break
			var tmp := _heap[smallest]
			_heap[smallest] = _heap[i]
			_heap[i] = tmp
			i = smallest
	return top


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
