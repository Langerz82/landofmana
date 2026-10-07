class_name AuctionWindow
extends ShopWindowBase
## Auction house (dialog/auction/*.js): your listings (delete), armor and
## weapons from other players (buy). SELL lists an item from the inventory.

func _init() -> void:
	super._init("AUCTION", Vector2(620, 0))


func build() -> void:
	super.build()
	set_tabs(["MY LISTINGS", "ARMOR", "WEAPON"])
	add_footer_button("SELL", func():
		inventory_window.open_mode(ItemActions.Mode.AUCTION, self)
		close())


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	super.bind(d, a, inv)
	d.auction_changed.connect(func(t):
		if visible and t == tab:
			_rebuild())


func tab_changed(i: int) -> void:
	actions.client().send([Types.Messages.CW_AUCTIONOPEN, i])


func rows() -> void:
	var list: Array = data.auctions.get(tab, [])
	if list.is_empty():
		add_info("Loading..." if not data.auctions.has(tab) else "No items listed.")
		return
	for e in list:
		var r: Dictionary = e.room
		var kind := int(r.kind)
		var mine := tab == 0
		var cb := func():
			if mine:
				actions.client().send([Types.Messages.CW_AUCTIONDELETE, int(e.index), tab])
			else:
				if int(e.price) > int(data.gold[0]):
					actions.notify_lang("SHOP_NOGOLD")
					return
				actions.client().send([Types.Messages.CW_AUCTIONBUY, int(e.index), tab])
		add_row(ItemTypes.icon(kind), ItemTypes.info_text(r), "Seller: " + str(e.player),
			"%dg" % int(e.price), "DELETE" if mine else "BUY", cb)
