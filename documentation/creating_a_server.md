Creating a Simple Server
=========================

In this example, we want to create a OPCUA Server that exposes 2 read/write variables

The server will expose the variable under a new folder named "MyDevice".

     + RootFolder
         + MyDevice
             + MyVariable1
             + MyVariable2


creating a OPCUA Server
-----------------------

```javascript
var opcua = require("node-opcua");
var options = {
    port: 1234 // specify the tcp port to listen
};
var server = new opcua.OPCUAServer(options);
```

the server end points can be found

```javascript
var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
```

Once created the server shall be initialised. During initialisation, the server will load
its default nodeset and prepare the binding of all OPCUA standard server variables.

```javascript
    server.initialize(function() {
        console.log("initialized");
        // we can now extend the default name space with our variables here
    });
```

Lets create a function that will extend the server default address space with some
variables that we want to expose. This function will be called inside the initialize callback.


declaring a new folder
----------------------

```javascript
     function createMyAddressSpace(server) {
        server.engine.createFolder("RootFolder",{ browseName: "MyDevice"});
     }
     createMyAddressSpace(server);
```


adding a variable
-----------------

Adding a read variable inside the server namespace requires only a getter function that returns a opcua.Variant
containing the value of the variable to scan.

```javascript
    var variable1 = 10.0;
    server.nodeVariable1 = server.engine.addVariableInFolder("MyDevice",
        {
            browseName: "MyVariable1",
            value: {
                get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: variable1 });}
            }
        });
```

Note that we haven't specified a nodeid for the variable.The server will automatically assign a new nodeId for us.

Let's create a more comprehensive Read-Write variable with a fancy nodeId

```javascript
    var variable2 = "some text";
    server.nodeVariable2 = server.engine.addVariableInFolder("MyDevice",
        {
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
```



starting a server
-----------------


Once the server has been created and initialised, we use the **start** asynchronous method to let the server
initiate all its endpoints and start listening to clients.

```javascript
    server.start(function(){
        console.log("  server on port", server.endpoints[0].port);
        console.log("  server now waiting for connections. CTRL+C to stop");
    });
```

