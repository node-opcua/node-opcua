var OPCUAServer = require("../lib/opcua-server.js").OPCUAServer;

var server = new OPCUAServer();

var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
var hostname = require("os").hostname().toLowerCase();

var discovery_server_endpointUrl = "opc.tcp://" + hostname + ":4840/UADiscovery";
console.log(" endpointUrl = ",endpointUrl);



console.log(" registering server to " + discovery_server_endpointUrl);

server.registerServer(discovery_server_endpointUrl,function(err){
    if (err) {
        //
        // cannot register server in discovery
        console.log(" warning : cannot register server into registry server");
    } else {
        console.log(" registering server: done.");
        server.start(function(){
            console.log("  server on port", server.endpoints[0].port);
            console.log("  server now waiting for connections. CTRL+C to stop");
        });

    }
});
