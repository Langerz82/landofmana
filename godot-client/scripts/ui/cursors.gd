class_name Cursors
## Mouse cursors from img/3/misc/cursors.png (game/gamecursor.js):
## hand, sword (attack), loot and talk.

const SHEET := "res://assets/img/3/misc/cursors.png"
const NAMES := ["hand", "sword", "loot", "talk"]

static var _images: Dictionary = {}
static var _current := ""


static func set_shape(shape: String) -> void:
	if shape == _current or DisplayServer.get_name() == "headless":
		return
	_current = shape
	if _images.is_empty():
		var tex: Texture2D = load(SHEET)
		if tex == null:
			return
		var img := tex.get_image()
		var cell := img.get_height()
		for i in range(NAMES.size()):
			_images[NAMES[i]] = img.get_region(Rect2i(i * cell, 0, cell, cell))
	var im: Image = _images.get(shape)
	if im:
		Input.set_custom_mouse_cursor(im, Input.CURSOR_ARROW, Vector2(4, 4))
