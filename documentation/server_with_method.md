# Creating a Simple Server

In this example, we will create a OPCUA Server that exposes an object with some methods.

## preparation

Now edit the [server_with_method.js](#preparation "save: | jshint ") script.

    _"creating the server"

### creating the server

In this section, we create a very simple server.

``` javascript

/* global console, require */
var opcua = require("node-opcua");

var server = new opcua.OPCUAServer({
    port: 4334 // the port of the listening socket of the server
});

function post_initialize() {

    var myDevice = server.engine.createFolder("RootFolder",{ browseName: "MyDevice"});

    _"adding a method on the device object"

    _"binding the method with your own function"

}

server.initialize(post_initialize);

server.start(function() {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
});

```

### adding a method on the device object

``` javascript
var method = server.engine.addMethod(myDevice,{

    browseName: "Bark",

    inputArguments:  [{

        name:"nbBarks",
        description: { text: "specifies the number of time I should bark" },
        dataType: opcua.DataType.UInt32

     },{
           name:"volume",
           description: { text: "specifies the sound volume [0 = quiet ,100 = loud]" },
           dataType: opcua.DataType.UInt32
     }],

    outputArguments: [{
         name:"Barks",
         description:{ text: "the generated barks" },
         dataType: opcua.DataType.String ,
         valueRank: 1
    }]
});
```


### binding the method with your own function


``` javascript

server.engine.bindMethod(method.nodeId,function(inputArguments,context,callback) {

    var nbBarks = inputArguments[0].value;
    var volume =  inputArguments[1].value;

    console.log("Hello World ! I will bark ",nbBarks," times");
    console.log("the requested volume is ",volume,"");
    var sound_volume = Array(volume).join("!");

    var barks = []; for(var i=0;i<nbBarks;i++){ barks.push("Whaff" + sound_volume);}

    var callMethodResult = {
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

