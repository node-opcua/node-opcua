
# Creating a Server with DA variable

In Part 8, of the OPCUA Specification
In this example, we will create a OPCUA Server that exposes an object with some DA Variable.


Now edit the [server_with_da_variables.js](#preparation "save:") script.

# preparation

``` javascript
_"creating the server"
```

### creating the server

In this section, we create a very simple server.

``` javascript
const { OPCUAServer, standardUnits, DataType, Variant } = require("node-opcua");
(async () => {
    try {
        _"inner"
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
})();
```

### inner

``` javascript

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

_"adding a DA Variable"


await server.start();
console.log("Server is now listening ... ( press CTRL+C to stop)");
```


### adding a DA Variable

``` javascript

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
```
