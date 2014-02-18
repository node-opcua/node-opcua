var OPCUAServer = require("../lib/opcua-server.js").OPCUAServer;

var server = new OPCUAServer();

endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
console.log("endpointUrl = ",endpointUrl);

console.log("server on port", server.endpoints[0].port);
server.start(function(){



});
