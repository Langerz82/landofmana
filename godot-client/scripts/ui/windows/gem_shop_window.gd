class_name GemShopWindow
extends GameWindow
## STORE button (storehandler.js + #shopDialog): buy gems through the web
## page of the official site. Opens the system browser.

const SKUS := [["2,000 GEMS - $10.00 USD", "GEMS10_10.00"], ["6,500 GEMS - $30.00 USD", "GEMS30_30.00"],
	["13,500 GEMS - $50.00 USD", "GEMS50_50.00"]]

var _user: LineEdit
var _sku: OptionButton
var _gems: Label


func _init() -> void:
	super._init("SHOP", Vector2(420, 0))


func build() -> void:
	var t := UiStyle.label("Please select your username or gift to another username and enter it below.", 13)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.custom_minimum_size = Vector2(400, 0)
	content.add_child(t)
	_user = LineEdit.new()
	_user.max_length = 16
	content.add_child(_user)
	_sku = OptionButton.new()
	for s in SKUS:
		_sku.add_item(s[0])
	content.add_child(_sku)
	content.add_child(UiStyle.button("Checkout", _checkout))
	var n := UiStyle.label("It may take up to 24-hours for your gems to show up in your account.", 12, Color(1, 1, 1, 0.7))
	n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	n.custom_minimum_size = Vector2(400, 0)
	content.add_child(n)
	_gems = UiStyle.label("", 14, Color(0.6, 1, 1))
	content.add_child(_gems)


func refresh() -> void:
	_user.text = Game.username
	if world and world.data:
		_gems.text = "Gems: %d" % world.data.gems


func _checkout() -> void:
	var base := str(Config.build.get("shopurl", "https://www.landofmana.com/play/paypal.html"))
	var url := "%s?shopUsername=%s&shopSKU=%s" % [base, _user.text.strip_edges().uri_encode(), SKUS[_sku.selected][1]]
	OS.shell_open(url)
