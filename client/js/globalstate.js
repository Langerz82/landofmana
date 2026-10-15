// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

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
