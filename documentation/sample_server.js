//
var opcua  = require("..");

// Let create an instance of OPCUAServer
var server = new opcua.OPCUAServer({
    port: 1234 // the port of the listening socket of the server
});

// we can set the buildInfo
server.buildInfo.productName = "MySampleServer1";
server.buildInfo.buildNumber = "7658";
server.buildInfo.buildDate = new Date(2014,5,2);


// the server needs to be initialized first. During initialisation,
// the server will construct its default namespace.
server.initialize(function() {

    console.log("initialized");

    // we can now extend the default name space with our variables
    construct_my_address_space(server);

    // we can now start the server
    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        console.log(endpointUrl);
    })

});


function construct_my_address_space(server) {
    // we create a new folder under RootFolder
    server.engine.createFolder("RootFolder", { browseName: "MyDevice"});

    // now let's add first variable in folder
    // the addVariableInFolder
    var variable1 = 10.0;

    server.nodeVariable1 = server.engine.addVariableInFolder("MyDevice",
        {
            nodeId: "ns=4;b=1020ffaa", // some opaque NodeId in namespace 4
            browseName: "MyVariable1",
            value: {
                get: function () {
                    var t = new Date() / 10000.0;
                    var value = variable1 + 10.0*Math.sin(t);
                    return new opcua.Variant({dataType: opcua.DataType.Double, value: value });}
            }
        });

    ///
    var variable2 = 10.0;

    server.nodeVariable2 = server.engine.addVariableInFolder("MyDevice",
        {
            browseName: "MyVariable2",
            value: {
                get: function () {
                    return new opcua.Variant({dataType: opcua.DataType.Double, value: variable2 });
                },
                set: function (variant) {
                    variable2 = parseFloat(variant.value);
                    return opcua.StatusCodes.Good;
                }
            }
        });



    var os = require("os");
    server.nodeVariable3 = server.engine.addVariableInFolder("MyDevice",
        {
            nodeId: "ns=4;b=1020ffab", // some opaque NodeId in namespace 4
            browseName: "MyVariable3",
            value: {
                get: function () {
                    // var value = process.memoryUsage().heapUsed / 1000000;
                    var percentageMemUsed = os.freemem() / os.totalmem() * 100.0;
                    value = percentageMemUsed;
                    return new opcua.Variant({dataType: opcua.DataType.Double, value: value });}
            }
        });

}
