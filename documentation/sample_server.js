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
        var variable1 = 1;
        
        // emulate variable1 changing every 500 ms
        setInterval(function(){  variable1+=1; }, 500);
        
        server.nodeVariable1 = server.engine.addVariableInFolder("MyDevice",{
                browseName: "MyVariable1",
                dataType: "Double",
                value: {
                    get: function () {
                        return new opcua.Variant({dataType: opcua.DataType.Double, value: variable1 });
                    }
                }
        });
        
        
        // add a variable named MyVariable2 to the newly created folder "MyDevice"
        var variable2 = 10.0;
        server.nodeVariable2 = server.engine.addVariableInFolder("MyDevice",{
        
            nodeId: "ns=4;b=1020FFAA", // some opaque NodeId in namespace 4
            browseName: "MyVariable2",
            dataType: "Double",    
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
        /**
         * returns the percentage of free memory on the running machine
         * @return {double}
         */
        function available_memory() {
            // var value = process.memoryUsage().heapUsed / 1000000;
            var percentageMemUsed = os.freemem() / os.totalmem() * 100.0;
            return percentageMemUsed;
        }
        
        server.nodeVariable3 = server.engine.addVariableInFolder("MyDevice", {
            nodeId: "ns=4;s=free_memory", // a string nodeID
            browseName: "FreeMemory",
            dataType: "Double",    
            value: {
                get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: available_memory() });}
            }
        });
    
    }
    
    construct_my_address_space(server);
    
    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
    });
}
server.initialize(post_initialize);