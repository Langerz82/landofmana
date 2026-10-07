class_name Types
## Port of shared/js/gametypes.js (protocol ids, enums and level tables).

const G_LATENCY := 75
const G_ROUNDTRIP := G_LATENCY * 2
const G_UPDATE_INTERVAL := 16
const G_TILESIZE := 16
const ATTACK_MAX := 1000

const UserMessages := {
	CU_CONNECT_USER = 1,
	CU_CREATE_USER = 2,
	CU_LOGIN_USER = 3,
	CU_CREATE_PLAYER = 4,
	CU_LOGIN_PLAYER = 5,
	CU_REMOVE_USER = 6,
	UC_WORLD_READY = 101,
	UC_WORLDS = 102,
	UC_VERSION = 103,
	UC_PLAYER_SUM = 104,
	UC_ERROR = 105,
}

const Messages := {
	BI_SYNCTIME = 200,
	CW_LOGIN_PLAYER = 201,
	CW_ITEMSLOT = 202,
	CW_APPEARANCEUNLOCK = 203,
	CW_ATTACK = 204,
	CW_AUCTIONBUY = 205,
	CW_AUCTIONDELETE = 206,
	CW_AUCTIONOPEN = 207,
	CW_AUCTIONSELL = 208,
	CW_BANKRETRIEVE = 209,
	CW_BANKSTORE = 210,
	CW_CHAT = 211,
	CW_COLOR_TINT = 212,
	CW_BLOCK_MODIFY = 213,
	CW_GOLD = 214,
	CW_PARTY = 215,
	CW_HARVEST = 216,
	CW_USE_NODE = 217,
	CW_LOOKUPDATE = 218,
	CW_LOOT = 219,
	CW_MOVE = 220,
	CW_MOVEPATH = 221,
	CW_QUEST = 222,
	CW_STATADD = 223,
	CW_STOREBUY = 224,
	CW_STORE_MODITEM = 225,
	CW_STORESELL = 226,
	CW_TALKTONPC = 227,
	CW_CRAFT = 228,
	CW_TELEPORT_MAP = 229,
	CW_WHO = 230,
	CW_SKILL = 231,
	CW_SHORTCUT = 232,
	CW_REQUEST = 233,
	CW_CONFIG = 234,

	WC_ERROR = 300,
	WC_PLAYER = 301,
	WC_ACHIEVEMENT = 302,
	WC_AUCTIONOPEN = 303,
	WC_ITEMSLOT = 304,
	WC_CHANGEPOINTS = 305,
	WC_CHAT = 306,
	WC_COLOR_TINT = 307,
	WC_DAMAGE = 308,
	WC_DESPAWN = 309,
	WC_APPEARANCE = 311,
	WC_GOLD = 312,
	WC_PARTY = 313,
	WC_PLAYERINFO = 314,
	WC_ITEMLEVELUP = 315,
	WC_STAT = 316,
	WC_LEVELUP = 317,
	WC_LIST = 318,
	WC_LOG = 320,
	WC_HARVEST = 321,
	WC_MOVE = 322,
	WC_MOVEPATH = 323,
	WC_NOTIFY = 324,
	WC_QUEST = 325,
	WC_SKILLEFFECTS = 326,
	WC_SKILLLOAD = 327,
	WC_SPAWN = 328,
	WC_SPEECH = 329,
	WC_STATINFO = 330,
	WC_TELEPORT_MAP = 331,
	WC_SKILL_XP = 332,
	WC_DIALOGUE = 333,
	WC_SET_SPRITE = 334,
	WC_SET_ANIMATION = 335,
	WC_BLOCK_MODIFY = 336,
	WC_VERSION = 338,
}

enum Orientation { NONE = 0, UP = 1, DOWN = 2, LEFT = 3, RIGHT = 4 }

enum EntityType {
	NONE = 0, PLAYER = 1, MOB = 2, ITEM = 3, ITEMLOOT = 4,
	NPCSTATIC = 5, NPCMOVE = 6, BLOCK = 8, TRAP = 9, NODE = 10
}

const NODE_CHEST_KIND := 99

static var exp_for_level: Array = []
static var attack_exp: Array = []
static var defense_exp: Array = []
static var weapon_exp: Array = []


static func _ensure_tables() -> void:
	if not exp_for_level.is_empty():
		return
	exp_for_level.resize(50)
	attack_exp.resize(50)
	defense_exp.resize(50)
	weapon_exp.resize(50)
	exp_for_level[0] = 0
	attack_exp[0] = 0
	defense_exp[0] = 0
	weapon_exp[0] = 0
	for i in range(1, 50):
		var points := int(floor(i * 300 * pow(1.5, i / 5.0)))
		exp_for_level[i] = points
		defense_exp[i] = points * 10 + 50
		attack_exp[i] = points * 10 + 50
		weapon_exp[i] = points * 10 + 50


static func _level_from(table: Array, xp: int) -> int:
	_ensure_tables()
	if xp == 0:
		return 1
	for i in range(1, 50):
		if xp < table[i]:
			return i
	return 50


static func get_level(xp: int) -> int:
	return _level_from(exp_for_level, xp)


static func get_attack_level(xp: int) -> int:
	return _level_from(attack_exp, xp)


static func get_defense_level(xp: int) -> int:
	return _level_from(defense_exp, xp)


static func get_weapon_level(xp: int) -> int:
	return _level_from(weapon_exp, xp)


static func exp_range_for_level(level: int) -> Vector2i:
	_ensure_tables()
	var lo: int = exp_for_level[clampi(level - 1, 0, 49)]
	var hi: int = exp_for_level[clampi(level, 0, 49)]
	return Vector2i(lo, hi)


static func orientation_as_string(o: int) -> String:
	match o:
		Orientation.LEFT:
			return "left"
		Orientation.RIGHT:
			return "right"
		Orientation.UP:
			return "up"
		Orientation.DOWN:
			return "down"
	return ""


## Same as entitymovingorientation.js getOrientation(p1, p2).
static func orientation_between(x1: int, y1: int, x2: int, y2: int) -> int:
	var dx := absi(x1 - x2)
	var dy := absi(y1 - y2)
	if dx > dy:
		return Orientation.LEFT if x1 > x2 else Orientation.RIGHT
	elif dy > dx:
		return Orientation.UP if y1 > y2 else Orientation.DOWN
	return Orientation.NONE


static func real_distance(x1: float, y1: float, x2: float, y2: float) -> int:
	return int(sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2)))


## JS String.prototype.format: replaces {0}, {1}... with args.
static func format(text: String, args) -> String:
	if not (args is Array):
		args = [args]
	var out := text
	for i in range(args.size()):
		out = out.replace("{%d}" % i, to_str(args[i]))
	return out


## Stringify a JSON value the way JS would (whole floats print without ".0").
static func to_str(v) -> String:
	if v is float and is_equal_approx(v, round(v)) and absf(v) < 1e15:
		return str(int(v))
	return str(v)


static func to_int(v) -> int:
	if v == null:
		return 0
	if v is String:
		return int(v) if v.is_valid_float() or v.is_valid_int() else 0
	return int(v)
