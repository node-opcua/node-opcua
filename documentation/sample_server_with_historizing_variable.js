const opcua = require("node-opcua");
const path = require("path");

function construct_address_space(server) {
  const addressSpace = server.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace();
 
  const vessel = namespace.addObject({
      browseName: "Vessel",
      organizedBy: addressSpace.rootFolder.objects
  });
  
  const vesselPressure = namespace.addAnalogDataItem({
      browseName: "Pressure",
      engineeringUnitsRange: {
          low:  0,
          high: 10.0
      },
      engineeringUnits: opcua.standardUnits.bar,
      componentOf: vessel
  });
 
  addressSpace.installHistoricalDataNode(vesselPressure);
 
  // simulate pressure change
  let t = 0;
  setInterval(function() {
    let value = (Math.sin(t/50)*0.70+Math.random()*0.20)*5.0+5.0;
    vesselPressure.setValueFromSource({dataType:"Double",value:value});
    t=t+1;
  }, 200);
  
};

(async () => {

    try {
        // Let's create an instance of OPCUAServer
        const server = new opcua.OPCUAServer({
            port: 26543, // the port of the listening socket of the server
            resourcePath: "/UA/MyLittleServer", // this path will be added to the endpoint resource name
            nodeset_filename: [
                opcua.nodesets.standard,
            ]
        });

        await server.initialize();

        console.log("certificateFile = ", server.certificateFile);
        console.log("privateKeyFile  = ", server.privateKeyFile);
        console.log("rejected folder = ",server.serverCertificateManager.rejectedFolder);
        console.log("trusted  folder = ",server.serverCertificateManager.trustedFolder);

        construct_address_space(server);
        
        await server.start();
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );

    } catch(err) {
        console.log("Error = ", error);
    }
})();
