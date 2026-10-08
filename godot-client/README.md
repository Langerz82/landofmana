# Land of Mana – Godot 4 client

A Godot 4 (GDScript) port of the browser client in `../client`. It talks to the
**unchanged** user server and game server using the same Socket.IO protocol as
the JavaScript client, so both clients can play together on one server.

Open this folder in **Godot 4.7** (`project.godot`) and press **F5**.

## What is ported

| Area | Status | Original JS |
| --- | --- | --- |
| Socket.IO v4 / Engine.IO v4 client over WebSocket | done | `socket.io.js` |
| Packet framing (`1`+JSON, `2`+gzip, CSV) | done | `gameclient.js`, `userclient.js` |
| Login hash (SHA-1 + CryptoJS-compatible AES) | done | `user.js` |
| Login, account creation, world + character select, character creation | done | `app/*.js`, `userclient/*` |
| Map loading (map0–2), tile layers, "high" tiles above entities, camera areas | done | `map/*.js`, `renderer/*` |
| Sprites & animations (2x sheets, flipped left, weapon layer) | done | `sprite.js`, `animation.js`, `rendererdrawentities.js` |
| Players, mobs, NPCs, items, harvest nodes/chests, blocks, traps | done (display) | `entity/*` |
| Keyboard movement (arrows/WASD/numpad) with the original tile-centre stop rules | done | `playerlocalmovement.js`, `updatermovement.js` |
| Click-to-move with path finding (AStarGrid2D, server path format) | done | `pathfinder.js`, `gamemovement.js` |
| Remote movement (`WC_MOVE`, `WC_MOVEPATH` lock-step) | done | `clientcallbacksmovement.js` |
| Combat: targeting (T/Y), click/Space attack, auto-repeat, damage numbers, death & respawn | done | `gameinteraction*.js`, `clientcallbackscombat.js` |
| Doors / teleports between maps | done | `gamecallbacks.js`, `clientcallbacksmap.js` |
| Chat, speech bubbles, notifications, announcements | done | `chathandler`, `bubble.js` |
| NPC dialogue & accepting quests | done | `gamedialogue.js`, `clientcallbacksquest.js` |
| HUD: HP / EP / XP bars, gold, target frame, FPS/coords | done | `renderer/rendererdrawhud.js`, HTML HUD |
| Sound effects, per-map music (M toggles) | done | `audio.js` |
| Inventory (50) + equipment (5): use, equip, drag & drop, split stacks, drop on the ground | done | `dialog/inventorydialog/*`, `inventoryhandler.js` |
| Shortcut bar (6 + ATK): drag items/skills on, keys 1–6, cooldowns, 4 layouts | done | `shortcut/*` |
| Skills: list, levels, details, self/target/attack skills, cooldowns | done | `dialog/skilldialog.js`, `skillhandler.js` |
| Player stats: levels, stat points (+), crit/damage formulas | done | `dialog/statdialog.js`, `playercombat.js` |
| Store (buy, sell mode), bank (items + gold), auction (list, buy, delete, sell) | done | `dialog/store*`, `bankdialog/*`, `auction*` |
| Craft, enchant and repair (NPC modes), looks (switch + unlock with gems) | done | `craft*`, `appearance/*` |
| Quest log, achievements (+ completion notice) | done | `questdialog.js`, `achievement*` |
| Party: invite / accept / kick / leader / leave, player right-click menu | done | `socialdialog.js`, `playerpopupmenu.js` |
| Settings (chat, sound, music, joystick, fullscreen, menu/button/panel border/panel background colours, font size, zoom, shortcut layout, health bar speed, log out) | done | `settingsdialog.js` |
| Gem shop (opens the payment page), leaderboard | done | `gemshop*`, `leaderboard*` |
| Chat commands (`/w`, `//`, `///`, `/party`, `/invite`, `/kick`, `/leader`, `/leave`, `/warp`, `/autopotion`, `/id`) | done | `chathandler.js` |
| Harvesting (axe/pickaxe on trees, rocks and nodes), pushing/placing blocks | done | `gameinteraction*.js` |
| Gamepad, touch joystick, cursor shapes | done | `gamepad.js`, `joystick.js`, `cursor*.js` |

### Notes on features that were dead in the JS client

* **Leaderboard** – the JS dialog had no data source. Here it downloads JSON
  from `"leaderboardurl"` in `config_build.json` and is hidden when that key is
  not set.
* **Guilds** – the server has no guild support, so guild commands only show a
  notice.
* **Player popup menu** – never opened in the JS client; here it is on right
  click on another player.
* **Auto potion** (`/autopotion`) is implemented on the client.
* The gem shop opens `"shopurl"` from `config_build.json` (default
  `https://www.landofmana.com/play/paypal.html`) in the system browser.

## Controls

| Input | Action |
| --- | --- |
| Left click | move / target / attack / talk / pick up / harvest |
| Right click on a player | party / whisper menu |
| Arrows, WASD, numpad 8/4/6/2 | walk |
| Space | attack or talk to what you face, advance dialogue, harvest |
| T / Y | next / previous target |
| 1–6 | shortcut bar |
| I / C / K / Q / J / O | inventory, player stats, skills, quests, achievements, social |
| Esc | close windows (or open settings when none is open) |
| Enter | open chat, Enter again to send, Esc to cancel |
| M | music on/off |
| F3 | FPS / coordinate overlay |

Health bars (your HP, the target frame and the bars over heads) slide to
new values over 500 ms; Settings -> Health bars changes it (instant, 250,
500 or 1000 ms).

With the horizontal shortcut bar (bottom-right corner) the menu icons are a
column in the middle of the right edge; with the vertical shortcut bar
(middle of the right edge) they are a row in the bottom-right corner
(Settings -> Shortcuts). The chat log stays in the bottom-left corner.

Windows: click an item once to select it, again to use it (or double click);
drag it onto another slot to move it, onto the shortcut bar to install it, or
outside the windows to drop it. Right click uses an item.

Gamepad: d-pad / left stick walk, A interact, X next target, Y inventory,
Start settings, Back stats, L1 + A/B/X for shortcuts 1–3, R1 + A/B/X for 4–6,
and the d-pad moves between buttons while a window is open.

## Server address

Defaults come from `assets/config/config_build.json` (same file as
`client/config/config_build.json`). The login screen lets you change host/port
(saved in `user://settings.cfg`). From the command line:

```
godot --path godot-client -- --server=127.0.0.1:1340 --log-packets
```

`--log-packets` prints every packet sent and received.

## Project layout

```
project.godot            autoloads: Config, GameData, Game
scenes/main.tscn         entry point (scripts/main.gd)
scripts/core/            config, shared data tables (shared/data/*.json), Types, session/time helpers
scripts/net/             Socket.IO client, packet codec, CryptoJS-compatible login hash, user & game clients
scripts/world/           World (game.js + callbacks + updater), map data/renderer, path finder, audio
scripts/world/entities/  Entity → EntityMoving → Character → Player / Mob / Npc, ItemEntity, StaticEntity
scripts/world/           also PlayerData (inventory/bank/quest/skill state) and ItemActions
scripts/ui/              login screen, HUD, overlay (names, health bars, bubbles, combat text), cursors
scripts/ui/widgets/      GameWindow, ItemSlot (drag & drop), modals, shortcut bar, touch joystick
scripts/ui/windows/      inventory, bank, store, craft, auction, looks, stats, skills, quests, ...
assets/                  copies of client/img, audio, fonts, maps/*.json, data and shared/data
tests/                   headless integration tests (need running servers)
```

The game logic intentionally mirrors the JS client: positions are integer
pixels, logic runs on the original fixed 16 ms tick, and movement/path rules
are ported line by line so the server's validation accepts them.

## Keeping assets in sync

`assets/` is a copy. After changing art, maps or `shared/data` re-copy:

```
client/img/{2,3,common}   -> assets/img/
client/audio              -> assets/audio
client/fonts/*.ttf|*.otf  -> assets/fonts
client/maps/mapN/mapN.json -> assets/maps/mapN/
client/data/sprites/sprites.json -> assets/data/sprites.json
client/data/staticsheet.json     -> assets/data/
shared/data/*.json               -> assets/data/shared/
client/config/config_build.json  -> assets/config/
```

## Exporting

`export_presets.cfg` has Windows, Linux and Web presets. `include_filter` is set
to `*.json` because the maps and data tables are plain JSON read at runtime.
For the Web export the page must reach the servers over `ws://` (or `wss://`
when the page is served over https).

## Tests

With redis, the user server and the game server running locally:

```
godot --headless --path godot-client res://tests/compile_all.tscn
godot --headless --path godot-client res://tests/net_smoke_test.tscn
godot --headless --path godot-client res://tests/play_test.tscn     -- --user=tester1 --pass=secret1
godot --headless --path godot-client res://tests/scenario_test.tscn -- --user=tester2 --pass=secret1
godot --headless --path godot-client res://tests/death_test.tscn    -- --user=tester1 --pass=secret1
godot --headless --path godot-client res://tests/ui_flow_test.tscn
godot --headless --path godot-client res://tests/systems_test.tscn  -- --user=systest1 --pass=pw12345
godot --path godot-client res://tests/npc_dialogue_test.tscn
godot --path godot-client res://tests/npc_noquest_test.tscn  -- --user=npcdlg2 --pass=secret1
godot --path godot-client res://tests/menu_layout_test.tscn
godot --path godot-client res://tests/flash_capture_test.tscn -- --shots=/some/dir
godot --headless --path godot-client res://tests/health_bar_test.tscn
```

They create the account/character when it does not exist, then log in, walk,
attack, chat, talk to the Old Man, use the map doors and so on.

`npc_dialogue_test` talks to the Old Man with real mouse clicks and the Space
key: speech bubble, dialogue box, advancing lines, quest acceptance. It needs
a fresh character for the quest part (change `user` in the script).
`npc_noquest_test` checks the reward and "no more quests, head EAST and
look for …" lines once the Old Man's quests are done (see the script header
for the redis command that prepares the character).

`systems_test` drives the town NPCs end to end: buy, equip/unequip, split,
sell, drop & loot, bank items and gold, enchant, repair, auction list/delete,
craft, looks, stat points, skills and shortcuts, and every other window. Its
character needs gold (each run spends some, and enchanting gets more
expensive), for example `redis-cli hset p:Systest1 gold_0 500000`. Add
`--shots=/some/dir` (run with a display, e.g. under `xvfb-run` with
`--rendering-driver opengl3`) to save a screenshot of each window.
