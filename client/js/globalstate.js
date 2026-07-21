// New file (not derived from an existing AMD module) added during the ES6 conversion.
//
// Several legacy handlers/dialogs (shortcuthandler.js, inventoryhandler.js, gamepad.js,
// skillhandler.js, dialog/skilldialog.js, dialog/bankdialog.js, main.js, settingshandler.js,
// and others) share mutable "global" drag/shortcut state - DragItem, DragBank, ShortcutData,
// ShortcutStyle - across files by
// reading/writing a bare identifier with no `var`/`let`/`const`. In the old non-strict AMD/
// RequireJS closures, a bare `X = value` assignment implicitly created a `window.X` property
// the first time it ran, and every other closure could then read/write that same bare
// identifier since it resolved to the global object. Native ES modules run in strict mode,
// where assigning to a truly undeclared identifier throws a ReferenceError instead of
// silently creating a global - but assigning to an identifier that already resolves to an
// existing global property is perfectly legal. This file seeds those properties once, up
// front, so every module's existing bare-identifier reads/writes keep working unchanged.
//
// This module must be imported (for its side effect) early in the dependency graph -
// before any user interaction can trigger the handlers/dialogs above - which is guaranteed
// by importing it first from game.js.
window.DragItem = window.DragItem ?? null;
window.DragBank = window.DragBank ?? null;
window.ShortcutData = window.ShortcutData ?? null;
// FIX: ShortcutStyle was assigned bare (no var) in settingshandler.js and read bare in
// gamepad.js with no seed anywhere - a ReferenceError under ES module strict mode. Seeded
// here like its siblings above; "horizontal-asc" matches settingshandler.js's own fallback
// default (see its fnSetShortcut("horizontal-asc") call for non-mobile/tablet renderers).
window.ShortcutStyle = window.ShortcutStyle ?? 'horizontal-asc';
