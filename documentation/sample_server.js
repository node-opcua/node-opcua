var opcua = require("node-opcua");

// Let's create an instance of OPCUAServer
var server = new opcua.OPCUAServer({
    port: 4334 // the port of the listening socket of the server
});

// we can set the buildInfo
server.buildInfo.productName = "MySampleServer1";
server.buildInfo.buildNumber = "7658";
server.buildInfo.buildDate = new Date(2014,5,2);

function post_initialize() {
    console.log("initialized");
    function construct_my_address_space(server) {
    
        // declare some folders
         server.engine.createFolder("RootFolder",{ browseName: "MyDevice"});
    
        // add variables in folders
        // add a variable named MyVariable1 to the newly created folder "MyDevice"
        var variable1 = 10.0;
        server.nodeVariable1 = server.engine.addVariableInFolder("MyDevice",{
            browseName: "MyVariable1",
            value: {
                get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: variable1 });}
            }
        });
        
        // add a variable named MyVariable1 to the newly created folder "MyDevice"
        var variable2 = "some text";
        server.nodeVariable2 = server.engine.addVariableInFolder("MyDevice",{
                browseName: "MyVariable1",
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
        
        var os = require("os");
        /**
         * returns the percentage of free memory on the running machine
         * @returns {double}
         */
        function available_memory() {
            // var value = process.memoryUsage().heapUsed / 1000000;
            var percentageMemUsed = os.freemem() / os.totalmem() * 100.0;
            return percentageMemUsed;
        }
        
        server.nodeVariable3 = server.engine.addVariableInFolder("MyDevice", {
            nodeId: "ns=4;s=free_memory", // a string nodeID
            browseName: "FreeMemory",
            value: {
                get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: available_memory() });}
            }
        });
    
    }
    
    construct_my_address_space(server);
    
    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
    });
}
server.initialize(post_initialize);