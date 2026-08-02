# Code Review — client/js (2026-08-03)

Scope: full `client/js` tree, excluding `lib/` (vendored) and `compress.js` (minified bundle). This pass covers code written/refactored since the last two review docs (`CODE_REVIEW.md`, `code-review.md`) — the tree was split from flat files into subdirectories after those were written, so most of this code was previously unreviewed in its current location. Every item below was read and confirmed directly in the current source, not inferred from old review notes. Fixes already applied by prior passes are not repeated here.

## Critical

1. **`utils.js:135-136`** — `window.requestAnimFrame = (function(){ return \n window.requestAnimationFrame || ... })();`. Automatic semicolon insertion turns the bare `return` (newline immediately after it) into `return;`, so the IIFE always returns `undefined`. `window.requestAnimFrame` is never actually assigned a working function.

2. **`game.js:468`** — `requestAnimFrame(this.renderer.renderFrame());` runs every tick inside `gametick()` (driven by `setInterval`, `game.js:433-436`). Because of bug #1, `requestAnimFrame` is `undefined`, so this throws `TypeError: requestAnimFrame is not a function` on every single tick. The render call itself still fires (its return value is evaluated before the throw), but the throw aborts the rest of `gametick()`, so `this.processLogic = false` (line 470) never runs after the first tick. Also, structurally, this isn't how rAF is meant to be used — `this.renderer.renderFrame()` is invoked immediately, so even a working `requestAnimFrame` here wouldn't schedule anything, it'd just get called with the render's return value. Likely fix: drop the `requestAnimFrame` wrapper entirely and call `this.renderer.renderFrame();` directly, consistent with the comment above it noting the old rAF-driven loop was already removed as dead code.

3. **`leaderboardhandler.js:32`** — `let leaderJSON;` is declared but never assigned anywhere in the file or elsewhere in the codebase (confirmed by search). Every `$.each(leaderJSON, ...)` call across all leaderboard tabs (xp/pk/pkd/pd/tk/td/tkd, lines 40-82) iterates `undefined` and no-ops. The leaderboard UI currently renders permanently empty — looks like the `fetch` that used to populate `leaderJSON` was removed in an earlier cleanup pass without noticing it was the only assignment site.

## Correctness bugs

4. **`main/maininput.js:381`** — calls `Detect.isFirefoxAndroid()` but the file never imports `Detect` (only `Types`/`game`/`app` are declared globals at the top). Every chat-input focus event throws `ReferenceError: Detect is not defined`, so the placeholder-restore logic never runs, on any browser.

5. **`gamepad/gamepadbuttonscancel.js:75-82`** — reads `game.inventoryHandler.selectedItem` / calls `.deselectItem()`, but `InventoryHandler` has neither — that state lives on `game.inventoryDialog`. The gamepad "cancel" button can never deselect a highlighted inventory item; it always falls through to closing the whole window instead.

6. **`gamepad/gamepadbuttonsaction.js:79-84`** — gated on `game.selectedSkill`, which is never assigned anywhere (real state is `game.skillDialog.page.selectedSkill`), so the branch is dead. Even if reached, it calls `.format()` on an array (`playerShortcut`), but `.format()` is only defined on `String.prototype` — would throw.

7. **`dialog/skilldialog.js:267-269`** — `SkillDialog.update()` calls `this.page.update()`, but `SkillPage` has no `update` method. Currently unreachable (no caller), but a landmine for the next person who wires it up.

8. **`entity/item.js:64-65`** — `getInfoMsg()` calls `this.getInfoMsgEx(this)`, but `Item`'s constructor never sets the fields (`itemKind`, `itemDurability`, etc.) that `getInfoMsgEx` reads. No current callers (everyone uses the static `Item.getInfoMsgEx(itemRoom)` form instead), but same "landmine" class as above.

9. **`entity/entitymoving/entitymovingpath.js:116`, `entity/character/charactercombat.js:203`** — `if (spot && spot.x && spot.y)` treats a legitimate walkable spot at world coordinate `x===0` or `y===0` as falsy, so `follow()`/`followAttack()` silently refuse to move/attack there. Narrow map-edge case but a real bug — should check `!= null` rather than truthiness.

10. **`clientcallback/clientcallbacksspawn.js:119-124`** — `let spriteId;` is never assigned before `spriteId === 0 ? 'off' : 'on'`, so trap entities always animate `'on'` and can never visually show as disarmed. Comment marks this as a known carried-over gap, not yet resolved.

11. **`game/gamemovement.js:170-173`** — debug log `log.info('...validpath-mp4:' + JSON.stringify(path))` logs `path`, which is still `null` at that point; should log `gridPath` (the value just computed). Cosmetic (log-only) but always prints the wrong thing.

## Netcode / reliability (open TODOs on live paths)

12. **`updater/updatermovement.js:170, 225`** — `// TODO - Fix character stuttering thats corrupting the map display and collision.` is still open in both per-tick movement dispatchers (`updateCharacterPathMovement`, `updatePlayerPathMovement`). Carried over unresolved from the pre-refactor review.

13. **`clientcallback/clientcallbackssocial.js:26-35`** (`onDisconnected`) — `// TODO - Try and reconnect on dc.` still open; disconnect just kills the player/hides dialogs, no reconnection attempt.

14. **`clientcallback/clientcallbacksupdates.js:77-82`** (`onSetAnimation`) — body is `// TODO - Not yet implemented.` but `WC_SET_ANIMATION` is a live, registered message handler — any animation packet from the server is silently dropped.

15. **`clientcallback/clientcallbacksmovement.js:58-67, 87, 134-143`** — three `console.warn(...)` calls (dropped-move/movePath, desync correction) fire unconditionally, labeled as temporary "teleport-debug" instrumentation. Everything else in this file was already migrated to gated `log.debug` by the prior review — these were added afterward and left ungated. Under packet loss/high latency (exactly when they fire most) they'll flood the console.

## Performance

16. **`updater/updater.js:46-47`** (`updateCharacters`) — `// TODO - Optimization not working. This code is intensive.` sits directly above `game.forEachEntity(...)`, which runs every tick for every entity. Live, unresolved perf TODO on a hot path.

17. **`entity/entitymoving/entitymovingspatial.js:93, 140-146`** (`getClosestSpot`) — calls into `game.getEntitiesAround()`, an O(n) scan over nearby entities, on every `follow()`/`followAttack()` call (every mob chase step, every player attack-move). Same class of issue `CODE_REVIEW.md` already flagged for `game.js`'s entity lookups — worth spatial-indexing entities the way `itemGrid` already is.

## Maintainability

18. **`entity/entity.js:280-282`, `entity/entitymoving/entitymoving.js:51-53`, `entity/character/character.js:200-202`** — `onRemove(callback)` is defined identically at three levels of the inheritance chain; only the most-derived one is ever reached. Same duplication the prior review flagged pre-refactor — the file split spread the copies across three files instead of two rather than fixing it. Same pattern for `canMove()` in `character.js:204-206` vs `entitymovingpath.js:372-374`.

19. **`entity/character/character.js:166-168`** — `hasWeapon()` always returns `false` and is currently uncalled (real checks go through `PlayerItems.hasWeapon()`). Dead/misleading API surface — remove or wire up.

20. **`entity/character/charactercombat.js:53-64`** (`hurt()`/`stopHurting()`) — reference `this.sprite`/`this.hurtSprite`/`this.normalSprite`, none of which are ever assigned (entities use the `this.sprites` array). Both methods are dead; the file has a NOTE flagging this but the bug itself is unfixed.

21. **`app/app.js:447`** — `setGame(game) { game.client = game.client; ... }` is a no-op self-assignment, likely a leftover from a refactor where this meant to assign `this.client`.

22. **`game.js:376, 208`** — `removeItem()` computes `const id = item.id` but never uses it (dead local); `this.animFrame = typeof requestAnimFrame !== 'undefined'` is always `false` (see bug #1) and has no readers anywhere — dead flag.

23. **`main/maindialogs.js:61`** — writes to `InventoryDialog.inventory[...]`, an array that's never read anywhere else (real inventory state is `game.inventory.rooms`). Vestigial from before the inventory/handler split.

24. **`inventorydialog/inventorydialogdisplay.js:54`** — `// TODO - Work out why not emptying item shortcuts.` — open, known-unresolved display bug, not just cleanup.

25. **`clientcallback/clientcallbacksmap.js:168-171`** — sets `game.mapContainer.allready = true`, but `.allready` is never read anywhere in the codebase — write-only flag.

## Not flagged (verified clean / already fixed)

Both prior review passes' findings were spot-checked against their new post-refactor locations and confirmed fixed in place (with `// FIX:` comments) unless noted above as "carried over unresolved." This includes: the `.ready`-as-method bug, `c.map` dead code, `self`/`window.self` closure bugs, `setScale()` return-value bug, stacked dialog close-listeners, disabled per-frame dirty-check, full-entity-list `drawEntities` walk, un-reassigned name-sprite `.text`, and all previously-flagged XSS sites (chat, social, leaderboard, popup-menu) — all now correctly escape via `Utils.escapeHtml()` or `.text()`. No new XSS issues were found in this pass. `gameclient/`, `userclient/`, `entity/mob.js`, `entity/node.js`, `entity/npcmove.js`, `entity/npcstatic.js`, `entity/block.js`, `entity/player/playerlocalmovement.js` (notably well-documented), and most of `game/*.js` had no new findings.

## Suggested priority

Fix #1–#3 first — they're cheap, one-line changes with outsized impact (render loop throwing every tick; leaderboard completely non-functional). Then #4–#11 (real logic bugs, several currently live). #12–#17 are pre-existing, known, and lower urgency but worth scheduling. #18–#25 are cleanup, no rush.
