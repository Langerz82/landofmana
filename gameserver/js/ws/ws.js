// Split (see ws/ folder): this file used to define sServer/Connection/
// WS.WebsocketServer/WS.socketioConnection/WS.userConnection all in one
// ~450-line file. Each class now lives in its own file under ws/; this file
// just assembles the same `WS` object shape (WS.WebsocketServer,
// WS.socketioConnection, WS.userConnection) so every external caller
// (main.js) is unaffected.
import WebsocketServer from './websocketserver.js';
import SocketioConnection from './socketioconnection.js';
import UserConnection from './userconnection.js';

const WS = {};

WS.WebsocketServer = WebsocketServer;
WS.socketioConnection = SocketioConnection;
WS.userConnection = UserConnection;

export default WS;
