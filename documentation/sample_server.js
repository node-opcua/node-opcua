/*global require,setInterval,console */
const { OPCUAServer, Variant, DataType, StatusCodes} = require("node-opcua");


(async ()=>{

    // Let's create an instance of OPCUAServer
    const server = new OPCUAServer({
        port: 4334, // the port of the listening socket of the server
        resourcePath: "/UA/MyLittleServer", // this path will be added to the endpoint resource name
        buildInfo : {
            productName: "MySampleServer1",
            buildNumber: "7658",
            buildDate: new Date(2014,5,2)
        }
    });
    await server.initialize();
    console.log("initialized");
    
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    
    // declare a new object
    const device = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MyDevice"
    });
    
    // add some variables
    // add a variable named MyVariable1 to the newly created folder "MyDevice"
    let variable1 = 1;
    
    // emulate variable1 changing every 500 ms
    setInterval(() => {  variable1+=1; }, 500);
    
    namespace.addVariable({
        componentOf: device,
        browseName: "MyVariable1",
        dataType: "Double",
        value: {
            get:  () => new Variant({dataType: DataType.Double, value: variable1 })
        }
    });
    
    // add a variable named MyVariable2 to the newly created folder "MyDevice"
    let variable2 = 10.0;
    
    namespace.addVariable({
    
        componentOf: device,
    
        nodeId: "ns=1;b=1020FFAA", // some opaque NodeId in namespace 4
    
        browseName: "MyVariable2",
    
        dataType: "Double",    
    
        value: {
            get: () => new Variant({dataType: DataType.Double, value: variable2 }),
            set: (variant) => {
                variable2 = parseFloat(variant.value);
                return StatusCodes.Good;
            }
        }
    });
    const os = require("os");
    /**
     * returns the percentage of free memory on the running machine
     * @return {double}
     */
    function available_memory() {
        // var value = process.memoryUsage().heapUsed / 1000000;
        const percentageMemUsed = os.freemem() / os.totalmem() * 100.0;
        return percentageMemUsed;
    }
    namespace.addVariable({
    
        componentOf: device,
    
        nodeId: "s=free_memory", // a string nodeID
        browseName: "FreeMemory",
        dataType: "Double",    
        value: {
            get:  () => new Variant({dataType: DataType.Double, value: available_memory() })
        }
    });
    
    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
    });

})();
