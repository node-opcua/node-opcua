
import opcua from "node-opcua";

let totalPoints = 100000;
let batchSize = 5000;
let currentBatch = 0;


process.on("SIGINT", ()=> process.exit(0));
process.on("SIGTERM", ()=> process.exit(0));

function getRandom() {
    return new opcua.Variant({ dataType: opcua.DataType.Double, value: Math.random() });
}

function construct_address_space(server) {
    const addressSpace = server.engine.addressSpace;

    addressSpace.isFrugal = true;
    
    const namespace = addressSpace.getOwnNamespace();

    let counter = 0;
    // Function to create a batch of points
    function createBatch() {
        for (let i = currentBatch * batchSize + 1; i <= (currentBatch + 1) * batchSize; i++) {
            const vessel = namespace.addObject({
                browseName: `Vessel_${i}`,
                organizedBy: addressSpace.rootFolder.objects
            });

            let variable = {
                nodeId: `ns=1;s=Variable${i}`,
                browseName: `Pressure_${i}`,
                dataType: "Double",
                
                minimumSamplingInterval: 1000,  

                value: {
                    get: getRandom
                },
                componentOf: vessel
            }
            counter +=1;

            const vesselPressure = namespace.addVariable(variable);
           
        }

        currentBatch++;

        if (currentBatch * batchSize < totalPoints) {
            console.log(`Created ${currentBatch * batchSize} points`);
            console.log(" Memory usage ", process.memoryUsage());
            setTimeout(createBatch, 100); // Wait 1 second before creating the next batch
        }
        console.log(" Total points = ", counter);
        console.log(" Memory usage ", process.memoryUsage());
   }

    createBatch();

 
    // let t = 0;
    // setInterval(function () {
    //     for(let i = 0; i < allPoints.length; i++) { 
    //         let value = Math.random();
    //         let point = allPoints[i];
    //         point.setValueFromSource({ dataType: "Double", value: value });
    //     }
    // }, 60000);
}

(async () => {
    try {
        const server = new opcua.OPCUAServer({
            port: 26543,
            resourcePath: "/UA/MyLittleServer",
            nodeset_filename: [opcua.nodesets.standard]
        });

        await server.initialize();
        console.log("certificateFile = ", server.certificateFile);
        console.log("privateKeyFile  = ", server.privateKeyFile);
        console.log("rejected folder = ", server.serverCertificateManager.rejectedFolder);
        console.log("trusted  folder = ", server.serverCertificateManager.trustedFolder);

        construct_address_space(server);

        await server.start();
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl);
    } catch (err) {
        console.log("Error = ", err);
    }
})();