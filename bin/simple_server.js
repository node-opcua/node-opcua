Error.stackTraceLimit = Infinity;

var opcua = require("..");
var OPCUAServer = opcua.OPCUAServer;
var Variant = opcua.Variant;
var DataType = opcua.DataType;

var path = require("path");
var address_space_for_conformance_testing = require("../lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;


var default_xmlFile = __dirname + "/../nodesets/Opc.Ua.NodeSet2.xml";


console.log(" node set ", default_xmlFile);

var server = new OPCUAServer({ nodeset_filename: default_xmlFile});

var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
var hostname = require("os").hostname().toLowerCase();

var discovery_server_endpointUrl = "opc.tcp://" + hostname + ":4840/UADiscovery";
console.log(" endpointUrl = ", endpointUrl);

console.log(" registering server to " + discovery_server_endpointUrl);

server.registerServer(discovery_server_endpointUrl, function (err) {
    if (err) {
        //
        // cannot register server in discovery
        console.log(" warning : cannot register server into registry server");
    } else {
        console.log(" registering server: done.");
    }
});

server.on("post_initialize", function () {
    build_address_space_for_conformance_testing(server.engine);

    var myDevices = server.engine.createFolder("Objects", { browseName: "MyDevices"});

    server.engine.addVariableInFolder(myDevices,
        {
            browseName: "PumpSpeed",
            nodeId: "ns=2;s=PumpSpeed",
            dataType: "Double",
            value: {
                get: function () {
                    var pump_speed = 200 + 100*Math.sin(Date.now()/10000);
                    return new Variant({dataType: DataType.Double, value: pump_speed});
                },
                set: function (variant) {
                    return StatusCodes.BadNotWritable;
                }
            }
        });


    var usage_result = { memory : 0 , cpu: 100};
    
    var usage = require('usage');

    var pid = process.pid // you can use any valid PID instead
    var options = { keepHistory: true }
    setInterval(function() {
        usage.lookup(pid, options, function(err, result) {
          usage_result  = result;
          console.log("result", result);
        })
    },1000);

    server.engine.addVariableInFolder(myDevices, {
            browseName: "CPU%",
            nodeId: "ns=2;s=CPU",
            dataType: "Double",
            value: { get: function () { return new Variant({dataType: DataType.Double, value: usage_result.cpu}); } }
        });

    server.engine.addVariableInFolder(myDevices, {
            browseName: "CPU%",
            nodeId: "ns=2;s=Memory",
            dataType: "Number",
            value: { get: function () { return new Variant({dataType: DataType.UInt32, value: usage_result.memory}); } }
        });
});

server.start(function () {
    console.log("  server on port", server.endpoints[0].port);
    console.log("  server now waiting for connections. CTRL+C to stop");
    console.log("  endpointUrl = ", endpointUrl);
});
server.on("request", function (request) {
    console.log(request._schema.name);
    switch (request._schema.name) {
        case "ReadRequest":
            var str = "";
            request.nodesToRead.map(function (node) {
                str += node.nodeId.toString() + " " + node.attributeId + " ";
            });
            console.log(str);
            break;
        case "TranslateBrowsePathsToNodeIdsRequest":
            console.log(util.inspect(request, {colors: true, depth: 10}));
            break;
    }
    // console.log(util.inspect(request,{colors:true,depth:10}));
});
