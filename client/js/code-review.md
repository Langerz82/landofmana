# RetroRPGOnline2 Client — Code Review

Scope: full `client/js` tree (excluding `lib/` vendor code and `data/` tables). Findings from a high-level pass, grouped by severity.

## Second pass (deeper dive, all fixed)

A follow-up pass looked past the original findings for further bugs. All of the below are fixed; see `// FIX:` comments at each site.

- `app.js` (`npcDialoguePic`) — `sprite.animations` was dereferenced before the sprite-null check ran; now guards with an early return.
- `config.js` — the `config_build.json` fetch had no `.catch`; a failed fetch left the app polling `waitForConfig()` forever with no visible error. Added a `.catch` that logs the failure.
- `gameclient.js` (`receiveSpawn`) — guarded on `!game.mapContainer.ready`, but `.ready` is a method (always truthy), so the "don't spawn before map ready" check never fired. Fixed to use the boolean `mapLoaded` flag.
- `gameclient.js` (`sendMoveEntity`) — leftover unconditional `console.info` debug log on every move; switched to gated `log.debug`.
- `game.js` (`findPath`) — the error-logging branch for a missing `character` dereferenced `character.id`, throwing instead of logging cleanly.
- `game.js` (`playerInteract`) — `p.target.id` was logged unconditionally even when no target had been set, throwing a TypeError; now guarded.
- `updater.js` (`charPath`) — mid-path collision guard checked `c.map`, which is never set anywhere (should be `game.mapContainer`), so it was permanently dead code; also dropped a leftover debug `try/throw/console.error` trace inside that dead branch.
- `util.js` — `String.prototype.format` was defined twice; the second silently won, leaving the `.f` alias (bound to the first) pointing at dead code. Removed the duplicate and re-pointed `.f` at the surviving implementation.
- `mapcontainer.js` (`isDoor`) — passed the wrong shape (`{gx,gy}`) to `Area.contains()`, which reads `.x`/`.y`, and checked `!== null` against a function that only ever returns `true`/`false` — position was ignored entirely. Fixed the shape and dropped the dead null-check.
- `mapcontainer.js` / `sprites.js` — zip-entry load promises had no `.catch`, so a corrupt/missing entry left map/sprite loading silently stuck forever (same class of bug already fixed in `map.js`). Added `.catch` handlers.
- `entity/character.js` (`followAttack`) — never returned a value, but its only caller (`Player.makeAttack`) branches on the return, so attacks always reported `"attack_toofar"` even when movement toward the target started. Now returns `true`/`false`.
- `entity/components/playercombat.js` (`baseDamage`) — referenced `Mob` without importing it; would throw `ReferenceError` the first time called with a defender argument. Added the import.
- `entity/item.js` (`getState`) — missing `return`, and called an undefined `_getBaseState()`. Fixed the return; left a TODO on the undefined base method since it has no current callers and the intended wire format is unknown.
- `entity/components/playeritems.js` (`hasWeaponType`) — defaulted `type` to `"any"` and returned `true` immediately, before even checking for an equipped weapon, permanently orphaning the intended fallback branch. Fixed to only short-circuit on an explicit `"any"`, matching the sibling `hasHarvestWeapon`.
- `renderer.js` (`drawText`) — dead code, no call sites, referenced an undefined `this.defaultFont` and never used its own output; removed.
- `renderer.js` (`drawEntities`) — an `else` branch dereferenced `game.player.id` unconditionally; not currently reachable but one refactor away from a null-deref. Guarded.
- `entity/entitymoving.js` (`nextMove`/`nextTile`) — computed a `dist` default and then ignored it, passing a hardcoded literal instead. Now actually used.
- `dialog/craftdialog.js` (`StorePage.open`) — a filtered-out item was spliced from the list, but a following non-`else` check still ran against it, `indexOf` returned `-1`, and `splice(-1,1)` deleted an unrelated (usually the last) craft item. Made the checks mutually exclusive. Also removed a dead `Object.assign` copy that was immediately discarded.
- `shortcuthandler.js` (`getSameShortcuts`) — the item-type branch matched on `type` alone, so using one consumable's cooldown visually applied to every item shortcut in the bar; now also requires matching `shortcutId`, consistent with `cooldownStart()`.
- `dialog/skilldialog.js` (`SkillPage.clear`) — `.html()` called with no argument is a no-op getter; the skill label was never actually cleared. Fixed to `.html('')`.
- `clientcallbacks.js` — a bare `game.renderer.forceRedraw;` property reference (should have been an assignment) meant the post-desync-correction redraw never actually got forced. Also `new SkillHandler(self)` referenced an undeclared `self` (resolving to `window.self`) instead of `game`.
- `tabbook.js` / `tabpage.js` — both constructors discarded their `parent` argument (`this.parent = parent` with no declared `parent` param in `TabBook`, and a no-op `this.parent;` in `TabPage`). Subclasses that go through `TabBook.add()` were unaffected because `setParent()` fixes it up later, but `SkillPage` is constructed directly and never goes through `add()`, so its `parent` stayed `undefined` — `active()` would throw if ever triggered on it. Both constructors now correctly assign `parent`.

**Status: all findings below have been fixed and verified** (syntax-checked with `node --check` across the whole non-vendor tree). See inline `// FIX:` / `// FIX (carried over):` comments at each site for what changed. By request, the `useBison`/BISON encode-decode path was kept in place rather than removed (it's still dead — `useBison` is hardcoded `false` in both `gameclient.js` and `userclient.js` — but that's now an intentional keep, not a bug); the swallowed-error fix in those `catch` blocks (now `log.error` instead of a silent `console.log`) was kept. TLS/`wss` enforcement depends on `config/config_build.json`, which lives outside this `client/js` tree and could not be verified from here — confirm separately that production builds set `protocol` to `wss`. The duplication-consolidation suggestions (shared rack/page/frame base class; `onRemove`/`canMove` dedup) were left as-is — they're refactors, not bugs, and weren't addressed in this pass.

## XSS / Security (fix first)

Chat, party/guild, leaderboard, and popup-menu code inserts server- or player-controlled strings (names, messages) into the DOM via `.html()`/string concatenation with no escaping. Any player can put `<img src=x onerror=...>` in their name or a chat message and run script in every other client that sees it.

- `chathandler.js:254, 266, 286-318` — `addToChatLog`/`addNormalChat`/`addGameNotification`/`addRatingNotification` build `'<p>' + entity.name + ': ' + message + '</p>'` directly.
- `socialhandler.js:35, 56, 107-134` — party/guild names and member lists via `.html()`.
- `leaderboardhandler.js:126-128` — leaderboard entries via `.html()`.
- `playerpopupmenu.js:92` — `$('#playerPopupMenuName').html(player.name)`.
- `gameclient.js:145`, `userclient.js:214` — server error messages appended as raw HTML.
- `clientcallbacks.js:830, 1232` — NPC dialogue/chat text via `.html()`.

**Fix:** escape untrusted strings (HTML-entity encode) or build nodes with `.text()` instead of `.html()`/concatenation everywhere on this list.

## Functional bugs

- `userclient.js:92-101` — compressed-message check strips only 1 char instead of 2, corrupting every `atob` decode; error is silently swallowed. Compressed server messages likely never process.
- `game.js:343-345` — `delete this.npc[id]` uses `id` before it's assigned; NPCs never actually get removed from `game.npc` (leak).
- `game.js:1443` — `getItemsAt` calls `this.map.isOutOfBounds(...)`, but `this.map` doesn't exist (should be `this.mapContainer`); throws if hit.
- `main.js:147` — `game.useServer === "world";` — comparison instead of assignment, no-op.
- `app.js:27-34` — `$('#user_hash').value = val` sets `.value` on a jQuery object (does nothing); should be `.val(val)`. Saved login never restores.
- `app.js:380, 414` — `username.length < 2 && username.length > 16` is impossible; length validation on registration/login forms never rejects bad input. Should be `||`.
- `app.js:159` — `default:` case references `result.reason` with no `result` in scope; throws if hit.
- `entity/entity.js:178` — `fadeInEntity()` sets `this.fadingTime.lastTime` but the timer object is `this.fadingTimer`; fade timing never resets on respawn/teleport.
- `entity/entity.js:104 & 153` — `getSpriteName` defined twice; second silently wins, first is dead and misleading.
- `entity/entitymoving.js:193-224` — `getClosestSpot` splices an array while iterating it with `for...of`, skipping elements; occupied tiles can slip through the walkability filter. Also missing `var entities` leaks a global.
- `entity/entitymoving.js:346` — `if (!this.path === null || ...)` — operator precedence bug, condition is effectively dead; should be `if (this.path === null || ...)`.
- `pathfinder.js:315` — calls `AStar(...)` directly instead of `AStar.AStar(...)`; throws, breaking the fallback path used when a destination is unreachable (silent NPC/mob movement failures).
- `playeranim.js:54-60` — reads `this.sprite[index]`, but the array is `this.sprites`; these methods throw if called.
- `renderer.js:1111-1131` — cached name/label sprites never get `.text` reassigned after creation, so name/stack-count changes don't render.
- `map.js:17-28` — zip-file-load promise has no `.catch`; a corrupt/missing map entry leaves the map stuck unloaded with no error surfaced.
- `bankdialog.js:349-351` — `setScale()` never assigns the return value to `this.scale` (every other dialog does); bank slot layout math is permanently broken (scale stuck at 0).
- `storehandler.js:8-11` — click handler sets `this.toggle` on the DOM element instead of the handler instance (missing `self` capture); toggle state never resets.
- `skillhandler.js:11-13` — `getName()` reads `this.skillData.name`, but constructor sets `this.data`; throws/undefined whenever called.
- `leaderboardhandler.js:136-143` — `pageData` used before initialization; produces literal `"undefined<option...>"` in pager HTML.
- `user.js:40-44` — `hash` logged before its `var hash =` declaration (hoisting bug); always logs `undefined`.
- `inventoryhandler.js:120-127` — `decInventory` decrements a local copy of `count`, never writes back to `item.itemNumber`; displayed stack counts drift until next server resync.
- `entity/npcstatic.js:20-22` — `getAnimationByName` ignores its argument and always returns `"idle_down"`; static NPCs can't animate other states.
- `entityfactory.js:13-14` — chest creation is commented out; `Chest` class is unreachable dead code.

## Memory leaks / performance

- `dialog.js:29-37` — `show()` adds a new close-button click listener every time without unbinding the old one; repeat dialog opens stack handlers, firing `hide()` multiple times per click.
- `mapcontainer.js:295-341` + `renderer.js:1442-1452` — per-frame grid rebuild runs unconditionally; the dirty-check that used to skip it when the camera hasn't moved is commented out. Real, scaling per-frame cost.
- `renderer.js:1015-1030` — `drawEntities` walks *all* entities every frame to hide them before re-showing on-screen ones; should track only entities that left the screen.
- `renderer.js:1648-1668` — blank-frame branch clears HUD containers but leaves entity sprites (`Container.ENTITIES`) in the display tree — orphaned PIXI objects accumulate.
- `game.js` — `useUpdateInRender` flag exists but its branch is commented out, so update logic may double-run on some devices.
- `game.js` — entity lookups (`forEachEntity`, `isOverlapping`, `getEntityAt`) are O(n) linear scans run on every mouse-move/tick; fine now, worth revisiting if entity counts grow.

## Global leaks (missing `var`/`let`)

Several loop counters and locals are assigned without declaration, leaking into the global/window scope and risking cross-function corruption: `entitymoving.js:197` (`entities`), `skillhandler.js:123` (`sl`), `inventoryhandler.js:49,67,77,88,98` (`i`), `inventorydialog.js:402,433` (`htmlItem`, `item`), `bankdialog.js:10,178` (`data`, `itemKind`).

## Dead code worth removing

- Large commented-out handler blocks in `gameclient.js`, `clientcallbacks.js`, `main.js`, `chathandler.js`, `settingshandler.js`, `socialhandler.js`.
- `entity/block.js:34-84` — dead block referencing undefined vars; would error if re-enabled.
- `sprite.js:70-86` — `setAnimation` references undefined `this.sprite`, superseded by `Entity`'s own handling.
- `leaderboardhandler.js:158-181` — unreachable `fetch(...)` block after an early `return`, marked `// TODO - FIX`.
- `shortcuthandler.js:236` — `delete this;` in `Cooldown.done()` is a no-op.
- `useBison` is hardcoded `false` in both network clients but the BISON encode/decode path is kept alive — commit to JSON or remove it.

## Duplication worth consolidating

- `craftdialog.js`, `storedialog.js`, `auctiondialog.js`, `appearancedialog.js` each reimplement a near-identical rack/page/frame class (~100+ lines apiece) differing only in button text/price field — good candidate for a shared base class.
- `onRemove`/`canMove` are duplicated near-verbatim across `entity.js`, `entitymoving.js`, `character.js`.

## Logging / hygiene

- `gameclient.js`/`userclient.js` log every outbound/inbound packet via `console.warn`, including login-hash payloads (`sendLoginPlayer`/`sendLoginUser`). Should be gated behind a debug flag before shipping.
- Confirm production sockets always connect over `wss` — commented-out `rejectUnauthorized`/`ca` options nearby suggest TLS verification was toggled during development.

---
*Reviewed via 3 parallel passes (core/networking, entities/rendering, UI/dialogs/handlers). `lib/` vendor code and `data/*.js` static tables were skipped.*
