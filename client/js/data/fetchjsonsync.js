// Shared helper for the data/*.js modules: synchronously loads and parses a JSON data file via
// jQuery's AJAX, replacing the earlier Node 'fs'.readFileSync-based approach.
//
// Why synchronous: every data/*.js module is consumed as a plain object/array/class at import
// time (e.g. `export default Items;`), matching how RequireJS's text! plugin used to load these
// files synchronously at define-time. Switching to a real async fetch() would turn every one of
// these modules' exports into a Promise, forcing async changes through every synchronous
// consumer across the codebase. jQuery's $.ajax with `async: false` preserves that original
// synchronous-load contract while loading over HTTP (via the page's own URL) instead of Node's
// filesystem API, so this no longer depends on NW.js Node integration being enabled.
//
// `path` is resolved relative to the page (e.g. 'shared/data/items2.json'), not relative to this
// module file.
//
// If config.build.version is available, it's appended as a `?version=` query param (matching the
// `?v=` cache-busting pattern already used for map/zip requests in map.js/mapcontainer.js) so a
// new build doesn't keep serving a stale cached copy of these data files. config.build loads
// asynchronously (see config.js) and several data/*.js modules call fetchJsonSync at import time,
// before that fetch can possibly resolve, so this degrades gracefully: if config.build isn't
// loaded yet, the request is made without the param (same as before this existed).
/* global $ */
import config from '../config.js';

export default function fetchJsonSync(path) {
    let result = null;
    let failure = null;

    const version = config.build ? config.build.version : undefined;
    const url = version
        ? path + (path.indexOf('?') === -1 ? '?' : '&') + 'v=' + version
        : path;

    $.ajax({
        url: url,
        dataType: 'json',
        async: false,
        cache: true,
        success: function(data) {
            result = data;
        },
        error: function(jqXHR, textStatus, errorThrown) {
            failure = textStatus + (errorThrown ? ' - ' + errorThrown : '');
        }
    });

    if (failure) {
        throw new Error('fetchJsonSync: failed to load "' + path + '": ' + failure);
    }

    return result;
}
