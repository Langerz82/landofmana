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
## Below this on-screen size (x normal) HUD text stops shrinking with the UI
## scale: at UI scale 0.5 the panels are half size but the text is 0.8x.
const MIN_UI_TEXT_SCALE := 0.8
const BASE_FONT_SIZE := 16        # Godot's default size for controls without an override
const FONT_SIZE_KEYS := ["font_size", "normal_font_size", "bold_font_size",
	"italics_font_size", "bold_italics_font_size", "mono_font_size"]
static var _font_hooked := false
const FONT_KEYS := ["font", "normal_font", "bold_font", "italics_font", "bold_italics_font", "mono_font"]
static var _hud_root: Control = null        # the scaled HUD root (Settings -> UI scale)
static var _hud_fonts := {}                  # original FontFile -> HUD copy


static func load_settings() -> void:
	menu_color = Color(str(Config.get_setting("ui", "menucolor", "#38A7DF")))
	button_color = Color(str(Config.get_setting("ui", "buttoncolor", "#F7B132")))
	panel_border = Color(str(Config.get_setting("ui", "panelborder", DEFAULT_PANEL_BORDER)))
	panel_bg = Color(str(Config.get_setting("ui", "panelbg", DEFAULT_PANEL_BG)))
	font_scale = clampf(float(Config.get_setting("ui", "fontscale", DEFAULT_FONT_SCALE)), FONT_SCALE_MIN, FONT_SCALE_MAX)
	ui_scale = clampf(float(Config.get_setting("ui", "uiscale", DEFAULT_UI_SCALE)), UI_SCALE_MIN, UI_SCALE_MAX)


# ----------------------------------------------------------- crisp text in the scaled HUD
# The HUD is drawn scaled (Settings -> UI scale). Glyphs rasterized at their
# nominal size and then stretched get uneven, blocky strokes, so the HUD uses
# its own copies of the fonts with `oversampling` = UI scale: glyphs are
# rasterized at the size they finally appear on screen and stay sharp. Text
# outside the HUD (login screen, names over the world, tooltips) keeps the
# original fonts at 1:1.

## Register the scaled HUD root: its theme gets the HUD copy of the default font.
static func set_hud_root(root: Control) -> void:
	_hud_root = root
	var th := Theme.new()
	var pt := ThemeDB.get_project_theme()
	var dt := ThemeDB.get_default_theme()
	var base: Font = ThemeDB.fallback_font   # gui/theme/custom_font ends up here or in a theme
	if pt != null and pt.has_default_font():
		base = pt.default_font
	elif dt != null and dt.has_default_font():
		base = dt.default_font
	th.default_font = hud_font(base)
	root.theme = th
	_set_hud_theme_size()
	_swap_tree(root)
	_scale_tree(root)


## The HUD copy of `f` (created once), rasterized at the current UI scale.
static func hud_font(f: Font) -> Font:
	if not (f is FontFile) or _hud_fonts.values().has(f):
		return f
	if not _hud_fonts.has(f):
		var d := fresh_copy(f)
		d.oversampling = _oversampling()
		_hud_fonts[f] = d
	return _hud_fonts[f]


## A new FontFile with the same font data and render settings as `f` but its
## own glyph cache. (Resource.duplicate() shares the cache textures of the
## sizes already drawn, so two copies drawing new glyphs into the same
## textures corrupt each other's letters.)
static func fresh_copy(f: FontFile) -> FontFile:
	var d := FontFile.new()
	d.data = f.data
	for p in ["antialiasing", "generate_mipmaps", "disable_embedded_bitmaps", "hinting",
			"subpixel_positioning", "keep_rounding_remainders", "force_autohinter",
			"modulate_color_glyphs", "allow_system_fallback", "fixed_size", "fixed_size_scale_mode",
			"multichannel_signed_distance_field", "msdf_pixel_range", "msdf_size", "oversampling",
			"font_name", "font_style", "font_weight", "font_stretch", "opentype_feature_overrides", "fallbacks"]:
		if p in f:
			d.set(p, f.get(p))
	return d


static var _world_text_font: FontFile = null

## Font for text drawn over the world (entity names, damage numbers, speech
## bubbles). Multichannel signed distance field: one set of glyphs serves
## every size, so changing the zoom never rasterizes new glyph sizes, and the
## text stays sharp at all of them. Draw it with a linear texture filter.
static func world_text_font() -> FontFile:
	if _world_text_font == null:
		_world_text_font = fresh_copy(KOMIKA)
		_world_text_font.multichannel_signed_distance_field = true
		_world_text_font.msdf_pixel_range = 32   # room for the outlines
		_world_text_font.msdf_size = 48
	return _world_text_font


static func _oversampling() -> float:
	return 0.0 if is_equal_approx(ui_scale, 1.0) else ui_scale


## After the UI scale changes: re-rasterize the HUD fonts for the new size.
static func update_hud_fonts(tree: SceneTree) -> void:
	for d in _hud_fonts.values():
		d.oversampling = _oversampling()
	if _hud_root and is_instance_valid(_hud_root):
		_set_hud_theme_size()
		_scale_tree(_hud_root)   # readability floor depends on the UI scale
		_notify_theme(_hud_root)
		_redraw_tree(_hud_root)


static func _redraw_tree(n: Node) -> void:
	if n is CanvasItem:
		n.queue_redraw()
	for c in n.get_children():
		_redraw_tree(c)


static func _swap_tree(n: Node) -> void:
	if n is Control:
		_use_hud_fonts(n)
	for c in n.get_children():
		_swap_tree(c)


## Controls inside the HUD use the HUD copies of fonts set in code.
static func _use_hud_fonts(c: Control) -> void:
	if not _in_hud(c):
		return
	for key in FONT_KEYS:
		if c.has_theme_font_override(key):
			var f := c.get_theme_font(key)
			var h := hud_font(f)
			if h != f:
				c.add_theme_font_override(key, h)


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
	_set_hud_theme_size()
	_scale_tree(root)
	_notify_theme(root)


## Extra factor for HUD text so it never gets smaller than MIN_UI_TEXT_SCALE
## on screen when the UI scale goes below that.
static func hud_text_boost() -> float:
	return maxf(1.0, MIN_UI_TEXT_SCALE / ui_scale)


## Font size for text drawn in code inside the HUD (Font size + readability floor).
static func hud_fs(size: float) -> int:
	return maxi(6, roundi(size * font_scale * hud_text_boost()))


static func _in_hud(c: Node) -> bool:
	return _hud_root != null and is_instance_valid(_hud_root) and (c == _hud_root or _hud_root.is_ancestor_of(c))


static func _set_hud_theme_size() -> void:
	if _hud_root and is_instance_valid(_hud_root) and _hud_root.theme:
		_hud_root.theme.default_font_size = hud_fs(BASE_FONT_SIZE)


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
	_use_hud_fonts(c)
	for key in FONT_SIZE_KEYS:
		if c.has_theme_font_size_override(key):
			var meta: String = "base_" + key
			if not c.has_meta(meta):
				c.set_meta(meta, c.get_theme_font_size(key))
			var base := int(c.get_meta(meta))
			var want := hud_fs(base) if _in_hud(c) else fs(base)
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
## Empty slot background (inventory, bank, shortcut bar...). Cell (0, 0) is
## the weapon slot (it shows a sword), so plain slots use an empty cell.
static func plain_slot_background() -> AtlasTexture:
	return slot_background(0, 0)


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
