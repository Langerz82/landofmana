
define(['text!../../shared/data/appearance.json'], function(AppearancesJson) {
	var Appearances = [];
	var appearanceParse = JSON.parse(AppearancesJson);

	$.each( appearanceParse, function( key, val ) {
		Appearances[key] = {
			name: val.name,
			type: val.type,
			sprite: val.sprite,
			buy: val.buy
		};
	});
    return Appearances;
});
