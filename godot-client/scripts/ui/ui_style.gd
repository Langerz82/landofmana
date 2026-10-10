class_name UiStyle
## Shared look of the in-game windows (replaces the CSS of the JS client).
## Menu/button colours are user settings (settingshandler.js menucolor/buttoncolor).

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const ITEM_BG := preload("res://assets/img/3/misc/itembackground.png")
const MENU_ICONS := preload("res://assets/img/common/menuicons.png")

const DEFAULT_PANEL_BORDER := "#38A7DF"
const DEFAULT_PANEL_BG := "#0F0D1AEB"   # RGBA; the alpha is the windows' opacity

static var menu_color := Color("#38A7DF")
static var button_color := Color("#F7B132")
static var panel_border := Color(DEFAULT_PANEL_BORDER)   # Settings -> Panel border
static var panel_bg := Color(DEFAULT_PANEL_BG)           # Settings -> Panel background
const DEFAULT_FONT_SCALE := 1.2   # font size scale used until the player picks one
static var font_scale := DEFAULT_FONT_SCALE   # Settings -> Font size: 1 = normal, >1 bigger, <1 smaller
const FONT_SCALE_MIN := 0.5
const FONT_SCALE_MAX := 2.0
const DEFAULT_UI_SCALE := 1.0
static var ui_scale := DEFAULT_UI_SCALE   # Settings -> UI scale: size of the whole HUD (panels, windows, icons)
const UI_SCALE_MIN := 0.5
const UI_SCALE_MAX := 1.5
const BASE_FONT_SIZE := 16        # Godot's default size for controls without an override
const FONT_SIZE_KEYS := ["font_size", "normal_font_size", "bold_font_size",
	"italics_font_size", "bold_italics_font_size", "mono_font_size"]
static var _font_hooked := false


static func load_settings() -> void:
	menu_color = Color(str(Config.get_setting("ui", "menucolor", "#38A7DF")))
	button_color = Color(str(Config.get_setting("ui", "buttoncolor", "#F7B132")))
	panel_border = Color(str(Config.get_setting("ui", "panelborder", DEFAULT_PANEL_BORDER)))
	panel_bg = Color(str(Config.get_setting("ui", "panelbg", DEFAULT_PANEL_BG)))
	font_scale = clampf(float(Config.get_setting("ui", "fontscale", DEFAULT_FONT_SCALE)), FONT_SCALE_MIN, FONT_SCALE_MAX)
	ui_scale = clampf(float(Config.get_setting("ui", "uiscale", DEFAULT_UI_SCALE)), UI_SCALE_MIN, UI_SCALE_MAX)


# ----------------------------------------------------------- font size

## A font size scaled by the Font size setting (for text drawn in code).
static func fs(size: float) -> int:
	return maxi(6, roundi(size * font_scale))


## Scale every text in the game by the Font size setting, now and for every
## control created later. Call once with the SceneTree (main / HUD do).
static func install_font_scaling(tree: SceneTree) -> void:
	if not _font_hooked:
		_font_hooked = true
		tree.node_added.connect(func(n: Node):
			if n is Control:
				_scale_control_fonts.call_deferred(n))
	apply_font_scale(tree)


## Re-apply the current font scale to the whole game (after the setting changes).
static func apply_font_scale(tree: SceneTree) -> void:
	var root := tree.root
	# Controls without their own size (buttons, option lists, popups...) use
	# the project / default theme's default size; HUD controls sit under
	# CanvasLayers, which a theme on the root window does not reach.
	var size := fs(BASE_FONT_SIZE)
	for th in [ThemeDB.get_project_theme(), ThemeDB.get_default_theme()]:
		if th != null:
			th.default_font_size = size
	ThemeDB.fallback_font_size = size
	_scale_tree(root)
	_notify_theme(root)


## Make controls drop their cached theme sizes after the shared theme changed.
static func _notify_theme(n: Node) -> void:
	if n is Control or n is Window:
		n.notification(Control.NOTIFICATION_THEME_CHANGED if n is Control else Window.NOTIFICATION_THEME_CHANGED)
		if n is Control:
			n.update_minimum_size()
	for c in n.get_children():
		_notify_theme(c)


static func _scale_tree(n: Node) -> void:
	if n is Control:
		_scale_control_fonts(n)
	for c in n.get_children():
		_scale_tree(c)
	if n is CanvasItem:
		n.queue_redraw()


## Controls with a size set in code keep that size as their "base" (meta) and
## get base * scale, so scaling never compounds.
static func _scale_control_fonts(c: Control) -> void:
	if not is_instance_valid(c):
		return
	for key in FONT_SIZE_KEYS:
		if c.has_theme_font_size_override(key):
			var meta: String = "base_" + key
			if not c.has_meta(meta):
				c.set_meta(meta, c.get_theme_font_size(key))
			var want := fs(int(c.get_meta(meta)))
			if c.get_theme_font_size(key) != want:
				c.add_theme_font_size_override(key, want)


## Background colour for a panel drawn at `alpha` opacity by default: the
## setting's colour, with its opacity scaled the same way (a HUD panel that
## used to be 0.6 stays proportionally more see-through than a window).
static func panel_bg_for(alpha: float) -> Color:
	var c := panel_bg
	c.a = clampf(panel_bg.a * alpha / 0.92, 0.0, 1.0)
	return c


## Re-colour a panel stylebox made by panel() / Hud.panel_style() after the
## colour settings change.
static func recolor_panel(sb: StyleBox) -> void:
	if sb is StyleBoxFlat and sb.has_meta("panel_alpha"):
		sb.bg_color = panel_bg_for(float(sb.get_meta("panel_alpha")))
		sb.border_color = panel_border


## Walks a node tree and re-colours every panel made by panel() / panel_style().
static func recolor_tree(n: Node) -> void:
	if n is Control:
		for key in ["panel", "normal"]:
			if n.has_theme_stylebox_override(key):
				recolor_panel(n.get_theme_stylebox(key))
	for c in n.get_children():
		recolor_tree(c)


static func panel(alpha := 0.92) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.set_meta("panel_alpha", alpha)
	sb.bg_color = panel_bg_for(alpha)
	sb.border_color = panel_border
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 10
	return sb


static func title_bar() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = menu_color.darkened(0.25)
	sb.set_corner_radius_all(5)
	sb.content_margin_left = 8
	sb.content_margin_right = 4
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	return sb


static func style_button(b: BaseButton) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = button_color.darkened(0.15)
	normal.set_corner_radius_all(5)
	normal.set_content_margin_all(5)
	normal.content_margin_left = 10
	normal.content_margin_right = 10
	var hover := normal.duplicate()
	hover.bg_color = button_color
	var pressed := normal.duplicate()
	pressed.bg_color = button_color.darkened(0.4)
	var focus := normal.duplicate()
	focus.draw_center = false
	focus.border_color = Color.WHITE
	focus.set_border_width_all(2)
	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.3, 0.3, 0.3)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("focus", focus)
	b.add_theme_stylebox_override("disabled", disabled)
	b.add_theme_color_override("font_color", Color.BLACK)
	b.add_theme_color_override("font_hover_color", Color.BLACK)
	b.add_theme_color_override("font_pressed_color", Color.WHITE)


static func button(text: String, cb: Callable = Callable(), min_w := 0) -> Button:
	var b := Button.new()
	b.text = text
	style_button(b)
	if min_w > 0:
		b.custom_minimum_size.x = min_w
	if cb.is_valid():
		b.pressed.connect(cb)
	return b


static func label(text: String, size := 14, color := Color.WHITE, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 3)
	if font:
		l.add_theme_font_override("font", font)
	return l


## A 32px icon cell from img/common/menuicons.png.
static func menu_icon(x: int, y: int) -> AtlasTexture:
	var at := AtlasTexture.new()
	at.atlas = MENU_ICONS
	at.region = Rect2(x, y, 32, 32)
	return at


## Slot background cell (56px) from img/3/misc/itembackground.png.
static func slot_background(cx: int, cy: int) -> AtlasTexture:
	var at := AtlasTexture.new()
	at.atlas = ITEM_BG
	at.region = Rect2(cx * 56, cy * 57, 56, 56)
	return at


## Sprite frame (first idle_down frame by default) as an AtlasTexture, for previews.
static func sprite_frame(sprite_id: String, anim := "idle_down", frame := 0) -> AtlasTexture:
	var def = GameData.get_sprite(sprite_id)
	if def == null or def.texture == null:
		return null
	var a: Dictionary = def.animations.get(anim, {})
	if a.is_empty():
		for k in def.animations:
			a = def.animations[k]
			break
	var s := GameData.SPRITE_SCALE
	var at := AtlasTexture.new()
	at.atlas = def.texture
	at.region = Rect2((int(a.get("col", 0)) + frame) * def.width * s, int(a.get("row", 0)) * def.height * s, def.width * s, def.height * s)
	return at
