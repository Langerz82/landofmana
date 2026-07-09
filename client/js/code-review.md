# RetroRPGOnline2 Client — Code Review

Scope: full `client/js` tree (excluding `lib/` vendor code and `data/` tables). Findings from a high-level pass, grouped by severity.

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
