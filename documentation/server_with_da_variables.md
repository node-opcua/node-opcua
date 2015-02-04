
# Creating a Server with DA variable

In Part 8, of the OPCUA Specification
In this example, we will create a OPCUA Server that exposes an object with some DA Variable.


# preparation

Now edit the [server_with_da_variables.js](#preparation "save: | jshint ") script.

    _"creating the server"

### creating the server

In this section, we create a very simple server.

``` javascript

/* global console, require */
var opcua = require("node-opcua");

opcua.standardUnits = require("node-opcua/lib/data_access/EUInformation").standardUnits;
opcua.addAnalogDataItem = require("node-opcua/lib/data_access/UAAnalogItem").addAnalogDataItem;

var server = new opcua.OPCUAServer({
    port: 4334 // the port of the listening socket of the server
});

function post_initialize() {

    var myDevice = server.engine.createFolder("RootFolder",{ browseName: "MyDevice"});
    _"adding a DA Variable"

} 

server.initialize(post_initialize);

server.start(function() {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
});

```

### adding a DA Variable

``` javascript

var fakeValue = 1;

var analogItem = opcua.addAnalogDataItem(myDevice,{
      browseName: "TemperatureSensor",
      definition: "(tempA -25) + tempB",
      valuePrecision: 0.5,
      engineeringUnitsRange: { low: 100 , high: 200},
      instrumentRange: { low: -100 , high: +200},
      engineeringUnits: opcua.standardUnits.degree_celsius,
      dataType: "Double",
      value: { get: function(){return new opcua.Variant({dataType: opcua.DataType.Double , value: fakeValue}); } }
});
```


