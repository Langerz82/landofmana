// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
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

// Split (see ws/ folder): this file used to define sServer/Connection/
// WS.WebsocketServer/WS.socketioConnection/WS.userConnection all in one
// ~410-line file (userserver/js/ws.js). Each class now lives in its own file
// under ws/ -- mirroring gameserver/js/ws/ws.js's identical split -- and this
// file just assembles the same `WS` object shape (minus WS.userConnection,
// which was never instantiated anywhere in this server; see wsbase.js's
// header for why there's no second Connection subclass to assemble here) so
// main.js's `ws.WebsocketServer`/`new WS.socketioConnection(...)` call sites
// are unaffected.
import WebsocketServer from './websocketserver.js';
import SocketioConnection from './socketioconnection.js';

const WS = {};

WS.WebsocketServer = WebsocketServer;
WS.socketioConnection = SocketioConnection;

export default WS;
