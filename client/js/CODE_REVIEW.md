# Code Review Notes — client/js

Scope: core game logic (~22.7k lines across 90 files), excluding `lib/` (bundled third-party) and `data/` (static tables). The codebase already carries many `FIX:`/`PERF:` comments from an earlier cleanup pass (AMD→ES6 conversion + bug fixes), so this pass focuses on what's still open.

## Performance

1. **`game.js:1508` `getEntityAt(x, y)`** — linear scan over every entity in `camera.entities` on each call. It's invoked every frame from `movecursor()` (`game.js:1794`) and repeatedly during targeting/interaction resolution. Fine at low entity counts, but scales O(n) per call in crowded areas. Worth indexing entities by grid cell (you already do this for `itemGrid`) and updating the index on move rather than scanning.

2. **`gamepad.js:1086-1101` `interval()`** — allocates a fresh `fnDeadZone` closure every call. `interval()` runs once per game tick whenever a gamepad is connected, so this is a function object allocated every ~50ms for no reason. Hoist it to a module-level function or class method.

3. **`updater.js:10-153`** — the constructor defines ~15 movement helpers (`checkStopDanger`, `charPath`, `charKey`, `playerKey`, etc.) as instance closures capturing `self`, instead of class methods using `this`. Since `Updater` is a singleton the memory cost is negligible, but it hides the API from the rest of the class (can't be found by name in a method list, harder to test in isolation) for no behavioral benefit — `self` here is just `this`.

4. **`pathfinder.js:144-159`** — `JSON.stringify(mp)` is computed unconditionally as an argument to `log.info(...)`, even when logging is disabled. `findDirectPath`/`findShortPath` run on essentially every click-to-move, so this pays stringify cost on every path request regardless of log level. Either guard with a log-level check first, or (better) confirm whether `log` supports lazy/callback-style messages.

5. **`renderer.js`** (e.g. `drawEntityName` ~1129, `removeHealthBar` ~1164) — sprite lookup keys are rebuilt via string concatenation (`"en_"+entity.id`, `"healthbar_ol_"+entityId`) multiple times per entity per frame. Cheap individually, but at higher entity counts this is avoidable churn — cache the key on the entity once.

6. **`game.js:685` `onPlayerLoad`** — registers a `setInterval` (zoning "who" ping) without storing the handle. If `onPlayerLoad` can ever fire more than once per session (reconnect), each call adds another uncleared interval. Store it (e.g. `game.zoneCheckInterval`) and `clearInterval` any previous one before creating a new one — same pattern already used correctly for `coolTimeCallback`, `cooltimeHandle`, etc. elsewhere.

## Correctness / worth a second look

7. **`util.js:29-36` `Utils.getUrlVars()`** — uses `String.replace()` purely for its side effect (populating `vars` inside the callback) and discards the actual replace result (`parts`). It works, but it's a fragile pattern to iterate matches with. A `matchAll` loop would be clearer and less likely to break under refactor.

8. **`util.js:276-304` `BinArrayToBase64`/`Base64ToBinArray`** — despite the name, these don't produce real base64 (`Array.prototype.toString('base64')` ignores the argument; it's really a comma-joined bit-chunk string that `Base64ToBinArray` decodes back the same way). They're internally consistent and `Base64ToBinArray` is used in `appearancedialog.js:346`, so this isn't broken, but the naming is misleading — worth a rename or a comment so a future reader doesn't "fix" it into real base64 and break the appearance-data wire format.

9. **`game.js:1247-1315` `makeNpcTalk`** — dispatches on `NpcData.Kinds[npc.kind].title` with a long `if/else if` chain of string comparisons, each re-reading `NpcData.Kinds[npc.kind].title` and duplicating the `this.gamepad.isActive() && this.gamepad.dialogNavigate()` call in almost every branch. Cache `const title = NpcData.Kinds[npc.kind].title;` once, and move the gamepad-navigate call after the chain (it's needed in every branch except the two that don't call it).

## Maintainability

10. **185 `var` declarations** remain across the non-lib codebase (vs. `let`/`const` used everywhere else) — mostly stray leftovers from the AMD→ES6 conversion (e.g. `game.js:816` `var checkTeleport`, `clientcallbacks.js:49` `var p`). Not a bug, but inconsistent with the rest of the modernized code.

11. **56 loose equality (`==`/`!=`) comparisons** remain (e.g. `game.js:1189` `if (skillId != -1)`). Worth a pass to `===`/`!==` for consistency, since the rest of the codebase is otherwise strict.

12. **28 `TODO`/`FIXME` markers** are still open in core files, several flagging known-broken behavior rather than just polish — e.g. `updater.js:238,312` ("character stuttering thats corrupting the map display and collision"), `game.js:2412` ("Overlapping Block Monsters is not working!!!"), `entity/entitymoving.js:561` ("probably broken with new path code"), `clientcallbacks.js:677` ("Try and reconnect on dc"). These are worth triaging since a couple sound like live gameplay bugs, not just cleanup items.

13. **`clientcallbacks.js`** registers ~50 message handlers as inline closures inside one large constructor (1341 lines total). Functionally fine, but splitting into named methods bound in a loop (or a lookup table of `{messageType: handlerMethod}`) would make individual handlers easier to find, test, and diff in code review.

14. Global-object prototype extension is used throughout `util.js` (`Number.prototype.mod/between/roundTo/roundUpTo/roundupsign`, `String.prototype.format/capitalizeFirstLetter/reverse`, `Array.prototype.In`). This is a known anti-pattern (risk of collision with future spec additions or third-party libs also patching these prototypes) — not urgent to change, but new helpers should probably be added as plain `Utils.*` functions instead of further prototype patches.

## Not flagged

`mapcontainer.js`'s collision-checking hot path (`isColliding`/`isCollidingPoint`) is already well optimized with documented before/after benchmarks, and `renderer.js`'s per-frame entity-visibility pass already avoids the O(n) full-world walk it used to do. Both are worth using as the template for #1 and #5 above.
