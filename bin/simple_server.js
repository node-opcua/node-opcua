var OPCUAServer = require("../lib/opcua-server.js").OPCUAServer;

var server = new OPCUAServer();

console.log("server on port", server.endpoints[0].port);
server.start();
