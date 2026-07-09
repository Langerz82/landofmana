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
/* global $ */
export default function fetchJsonSync(path) {
    let result = null;
    let failure = null;

    $.ajax({
        url: path,
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
