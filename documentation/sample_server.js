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
        console.log("Server is now listening ... ( press CTRL+C to stop)")
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
            browseName: "MyVariable1",
            value: {
                get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: variable1 });}
            }
        });

    ///
    var variable2 = "some text";

    server.nodeVariable2 = server.engine.addVariableInFolder("MyDevice",
        {
            browseName: "MyVariable2",
            value: {
                nodeId: "ns=4;b=1020FFAA", // some opaque NodeId in namespace 4
                get: function () {
                    return new opcua.Variant({dataType: opcua.DataType.Double, value: variable2 });
                },
                set: function (variant) {
                    variable1 = parseFloat(variant.value);
                    return opcua.StatusCodes.Good;
                }
            }
        });

}
