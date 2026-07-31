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
