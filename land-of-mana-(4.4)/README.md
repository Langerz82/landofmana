# Land of Mana – Godot 4 client

A Godot 4 (GDScript) port of the browser client in `../client`. It talks to the
**unchanged** user server and game server using the same Socket.IO protocol as
the JavaScript client, so both clients can play together on one server.

Open this folder in **Godot 4.4 or newer** (`project.godot`) and press **F5**.

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

### Not ported yet (stubbed)

These are separate HTML dialogs in the JS client and are the next passes:
inventory & equipment UI, shortcuts bar (1–6), skills, stats, shop, bank,
auction, craft, enchant/repair, appearance (Looks), party/social, leaderboard,
achievements UI, gamepad and touch controls. Talking to a shop-type NPC shows a
"not available yet" notice. The server data for these (inventory, bank,
quests, skills…) is already received; the Send* helpers for most of them are in
`scripts/net/game_client.gd`.

## Controls

| Input | Action |
| --- | --- |
| Left click | move / target / attack / talk / pick up |
| Arrows, WASD, numpad 8/4/6/2 | walk |
| Space | attack or talk to what you face, advance dialogue |
| T / Y | next / previous target |
| Enter | open chat, Enter again to send, Esc to cancel |
| M | music on/off |
| F3 | FPS / coordinate overlay |

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
scripts/ui/              login screen, HUD, overlay (names, health bars, bubbles, combat text)
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
```

They create the account/character when it does not exist, then log in, walk,
attack, chat, talk to the Old Man, use the map doors and so on.
