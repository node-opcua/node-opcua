const { OPCUAServer, standardUnits, DataType, Variant } = require("node-opcua");
(async () => {
    try {
        
        const server = new OPCUAServer({
            port: 4334 // the port of the listening socket of the server
        });
        
        
        await server.initialize();
        
        const addressSpace = server.engine.addressSpace;
        
        const namespace = addressSpace.getOwnNamespace();
        
        const myDevice = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "MyDevice"
        });
        
        
        let fakeValue = 1.0;
        
        const analogItem = namespace.addAnalogDataItem({
        
            componentOf: myDevice,
        
            browseName: "TemperatureSensor",
        
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: { low: 100 , high: 200},
            instrumentRange: { low: -100 , high: +200},
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: { get: ()=> new Variant({dataType: DataType.Double , value: fakeValue}) }
        });
        
        
        await server.start();
        console.log("Server is now listening ... ( press CTRL+C to stop)");
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
})();
