class_name LeaderboardWindow
extends GameWindow
## Rankings (leaderboardhandler.js). The JS client has no working data
## source for this; here it downloads JSON from config "leaderboardurl"
## ({playerName: {xp, pk, pd, tk, td}}) when that key is set.

const MODES := [["Experience", "xp"], ["Player kills", "pk"], ["PK ratio", "pkd"], ["Player deaths", "pd"],
	["Mob kills", "tk"], ["Mob deaths", "td"], ["Mob K/D", "tkd"]]
const PER_PAGE := 10

var _mode: OptionButton
var _page: SpinBox
var _table: Label
var _json: Dictionary = {}
var _http: HTTPRequest


func _init() -> void:
	super._init("RANKINGS", Vector2(380, 0))


static func available() -> bool:
	return str(Config.build.get("leaderboardurl", "")) != ""


func build() -> void:
	_mode = OptionButton.new()
	for m in MODES:
		_mode.add_item(m[0])
	_mode.item_selected.connect(func(_i):
		_page.value = 0
		_render())
	content.add_child(_mode)
	_page = SpinBox.new()
	_page.min_value = 0
	_page.prefix = "Page"
	_page.value_changed.connect(func(_v): _render())
	content.add_child(_page)
	_table = UiStyle.label("", 14)
	content.add_child(_table)
	_http = HTTPRequest.new()
	add_child(_http)
	_http.request_completed.connect(func(_r, code, _h, body):
		if code == 200:
			var d = JSON.parse_string(body.get_string_from_utf8())
			if d is Dictionary:
				_json = d
		_render())


func refresh() -> void:
	if available():
		_http.request(str(Config.build.leaderboardurl))
	_render()


func _render() -> void:
	var key: String = MODES[_mode.selected][1]
	var leaders: Array = []
	for n in _json:
		var v: Dictionary = _json[n]
		var val := 0.0
		match key:
			"pkd": val = float(v.get("pk", 0)) / float(v.get("pd", 0)) if float(v.get("pd", 0)) > 0 else 0.0
			"tkd": val = float(v.get("tk", 0)) / float(v.get("td", 0)) if float(v.get("td", 0)) > 0 else 0.0
			_: val = float(v.get(key, 0))
		if val > 0:
			leaders.append([n, val])
	leaders.sort_custom(func(a, b): return a[1] > b[1])
	var pages := maxi(1, int(ceil(leaders.size() / float(PER_PAGE))))
	_page.max_value = pages
	var p := int(_page.value)
	if p <= 0:
		p = 1
		for i in range(leaders.size()):
			if leaders[i][0] == (world.player.ename if world else ""):
				p = i / PER_PAGE + 1
	var lines: Array = []
	for i in range((p - 1) * PER_PAGE, mini(leaders.size(), p * PER_PAGE)):
		lines.append("%d.  %s   %s" % [i + 1, leaders[i][0], Types.to_str(snappedf(leaders[i][1], 0.01))])
	_table.text = "\n".join(lines) if not lines.is_empty() else ("No data." if available() else "No rankings server configured (config_build.json \"leaderboardurl\").")
