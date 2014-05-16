Error.stackTraceLimit = Infinity;

var OPCUAServer = require("..").OPCUAServer;
var path = require("path");
var default_xmlFile = __dirname + "/../nodesets/Opc.Ua.NodeSet2.xml";
var server = new OPCUAServer({ nodeset_filename: default_xmlFile});

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
    }
});

server.start(function(){
    console.log("  server on port", server.endpoints[0].port);
    console.log("  server now waiting for connections. CTRL+C to stop");
});
server.on("request",function(request){
    console.log(request._schema.name);
    switch(request._schema.name) {
        case "ReadRequest":
            var str = "";
            request.nodesToRead.map(function(node){str+= node.nodeId.toString() + " " + node.attributeId + " " ;});
            console.log(str);
            break;
        case "TranslateBrowsePathsToNodeIdsRequest":
            console.log(util.inspect(request,{colors:true,depth:10}));
            break;
    }
    // console.log(util.inspect(request,{colors:true,depth:10}));
});
