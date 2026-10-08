class_name UiStyle
## Shared look of the in-game windows (replaces the CSS of the JS client).
## Menu/button colours are user settings (settingshandler.js menucolor/buttoncolor).

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const ITEM_BG := preload("res://assets/img/3/misc/itembackground.png")
const MENU_ICONS := preload("res://assets/img/common/menuicons.png")

static var menu_color := Color("#38A7DF")
static var button_color := Color("#F7B132")


static func load_settings() -> void:
	menu_color = Color(str(Config.get_setting("ui", "menucolor", "#38A7DF")))
	button_color = Color(str(Config.get_setting("ui", "buttoncolor", "#F7B132")))


static func panel(alpha := 0.92) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.05, 0.1, alpha)
	sb.border_color = menu_color
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
