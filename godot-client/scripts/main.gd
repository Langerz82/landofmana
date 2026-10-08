extends Node
## Root of the application: shows the login screen, then the world.
## Port of the app/main bootstrap (client/js/main/*.js, app/*.js).

const LoginScreenScript := preload("res://scripts/ui/login_screen.gd")

var login: LoginScreen
var world: World
var hud: Hud
var overlay_layer: CanvasLayer
var login_layer: CanvasLayer


func _ready() -> void:
	Game.main = self
	get_window().title = "Land of Mana"
	UiStyle.load_settings()
	UiStyle.install_font_scaling(get_tree())   # Settings -> Font size
	_show_login()


func _show_login() -> void:
	_teardown_world()
	login_layer = CanvasLayer.new()
	login_layer.layer = 20
	add_child(login_layer)
	login = LoginScreenScript.new()
	login_layer.add_child(login)
	login.enter_world.connect(_on_enter_world)


func _on_enter_world(info: Dictionary) -> void:
	# The user client disconnects itself once UC_WORLD_READY arrives.
	login_layer.queue_free()
	login_layer = null
	login = null
	world = World.new()
	world.name = "World"
	add_child(world)
	overlay_layer = CanvasLayer.new()
	overlay_layer.layer = 5
	add_child(overlay_layer)
	var overlay := Overlay.new()
	overlay.world = world
	overlay_layer.add_child(overlay)
	world.overlay = overlay
	hud = Hud.new()
	hud.world = world
	add_child(hud)
	world.hud = hud
	hud.respawn_pressed.connect(func(): world.respawn_player())
	hud.back_to_login.connect(_show_login)
	world.start(info)


func _teardown_world() -> void:
	if world:
		world.client.close()
		world.queue_free()
		world = null
	if hud:
		hud.queue_free()
		hud = null
	if overlay_layer:
		overlay_layer.queue_free()
		overlay_layer = null
