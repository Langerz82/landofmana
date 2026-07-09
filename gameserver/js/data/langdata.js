import _ from 'underscore';
import LangJson from "../../shared/data/lang.json" with { type: 'json' };

const LangData = {};

_.each( LangJson, function( val, key ) {
	LangData[key] = val;
});

export const Data = LangData;
export default { Data };
