Now edit the [server_with_method.js](#creating-a-simple-server-with-method "save:") script.

## creating a simple server with method

In this example, we will create a OPCUA Server that exposes an object with some methods.

    _"program"

### program

In this section, we create a very simple server.

``` javascript

/* global console, require */
const opcua = require("node-opcua");


(async () => {

    try {
        _"creating the server"
    }
    catch(err) {
        console.log(err);
    }
})();
```

### creating the server

``` javascript
const server = new opcua.OPCUAServer({
    port: 4334 // the port of the listening socket of the server
});


await server.initialize();

const addressSpace = server.engine.addressSpace;
const namespace = addressSpace.getOwnNamespace();

const myDevice = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "MyDevice"
});

_"adding a method on the device object"

_"binding the method with your own function"

await server.start();
console.log("Server is now listening ... ( press CTRL+C to stop)");
const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
console.log(" the primary server endpoint url is ", endpointUrl );

```

### adding a method on the device object

``` javascript
const method = namespace.addMethod(myDevice,{

    browseName: "Bark",

    inputArguments:  [
        {
            name:"nbBarks",
            description: { text: "specifies the number of time I should bark" },
            dataType: opcua.DataType.UInt32        
        },{
            name:"volume",
            description: { text: "specifies the sound volume [0 = quiet ,100 = loud]" },
            dataType: opcua.DataType.UInt32
        }
     ],

    outputArguments: [{
         name:"Barks",
         description:{ text: "the generated barks" },
         dataType: opcua.DataType.String ,
         valueRank: 1
    }]
});

// optionally, we can adjust userAccessLevel attribute 
method.outputArguments.userAccessLevel = opcua.makeAccessLevelFlag("CurrentRead");
method.inputArguments.userAccessLevel = opcua.makeAccessLevelFlag("CurrentRead");
```


### binding the method with your own function


``` javascript

method.bindMethod((inputArguments,context,callback) => {

    const nbBarks = inputArguments[0].value;
    const volume =  inputArguments[1].value;

    console.log("Hello World ! I will bark ",nbBarks," times");
    console.log("the requested volume is ",volume,"");
    const sound_volume = Array(volume).join("!");

    const barks = [];
    for(let i=0; i < nbBarks; i++){
        barks.push("Whaff" + sound_volume);
    }

    const callMethodResult = {
        statusCode: opcua.StatusCodes.Good,
        outputArguments: [{
                dataType: opcua.DataType.String,
                arrayType: opcua.VariantArrayType.Array,
                value :barks
        }]
    };
    callback(null,callMethodResult);
});
```

## start the server

```
$ node server_with_method.js
```

