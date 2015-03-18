# Creating a Simple Server


In this example, we want to create a OPCUA Server that exposes 3 read/write variables

The server will expose the variable under a new folder named "MyDevice".

     + RootFolder
         + MyDevice
             + MyVariable1
             + MyVariable2


The first steps assumes that you are running a shell in a terminal on Linux or Mac,
or under [Git Bash](http://msysgit.github.io/) cmd on Windows.

## preparation

* (note: please make sure node.js is installed. Follow the instructions [here](http://nodejs.org/) ).


Let's create a node project for our server.

``` shell
    $ mkdir myserver
    $ cd myserver
    $ npm init                      # create a package.json
    $ npm install node-opcua --save # add the node-opcua
```

## creating certificates

A server certificate is required. Let's generate a self-signed private key.
By default, the server will search for a certificate named **cert.pem** in the **certificates** folder.

``` shell
    $ mkdir certificates
    $ openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout certificates/key.pem -out certificates/cert.pem
```

Then, answer the question requested by openssl (organizational  name , address and so on )
The server private key is key.pem.

The public key can be extracted with the following command

``` shell
    $ openssl rsa -in certificates/key.pem -pubout > certificates/public_key.pub
```


## the server script

Now edit the [sample_server.js](#the server script "save: | jshint ") script.

The script will be organised around the following four steps:

    _"declaration"

    _"server instantiation"

    _"server initialisation"

Let visit each step in order:

### declaration

The node-opcua sdk is made available to the application by this 'require' statement:

```javascript
/*global require,setInterval,console */
var opcua = require("node-opcua");

```

### server instantiation

A OPCUAServer instance need to be created.
Options can be passed to the OPCUAServer to customize the behavior.
For a simple server, you just need to specify a TCP port.

```javascript

// Let's create an instance of OPCUAServer
var server = new opcua.OPCUAServer({
    port: 4334, // the port of the listening socket of the server
    resourcePath: "UA/MyLittleServer", // this path will be added to the endpoint resource name
    _"setting server info"
});
```

The resource path will be used to construct the endpoint uniform resource identifier (uri) of our server.
In our case, the endpoint urn of our server will be <pre>opc.tcp://<hostname>:4334/UA/MyLittleServer</pre>
where <pre>hostname</pre> shall be replaced with your computer name or fully qualified domain name.

Client will have to use this URN to connect to the server.


### setting server info

additional information can be set at this stage such as the server *buildInfo*.

```javascript
 buildInfo : {
    productName: "MySampleServer1",
    buildNumber: "7658",
    buildDate: new Date(2014,5,2)
}
```

### server initialisation

Once created the server shall be initialised.
During initialisation, the server will load its default **nodeset** and prepare the binding of all standard OPCUA variables.
The **initialize** method is a asynchronous operation that requires a 'callback' function that will get executed
when the initialization process is completed. the *callback* is function that contains the post_initialisation
steps that we want to execute.

```javascript
function post_initialize() {
    console.log("initialized");
    _"post initialisation"
}
server.initialize(post_initialize);
```

#### post initialisation

Once the server has been initialized, it is a good idea to extend the default server namespace with our variables.

Lets create a function that will extend the server default address space with some
variables that we want to expose. This function will be called inside the initialize callback.


```javascript

function construct_my_address_space(server) {

    // declare some folders
    _"declare a new folder"

    // add variables in folders
    _"add a variable"

}

construct_my_address_space(server);

_"start the server"

```


##### declare a new folder

```javascript
 server.engine.createFolder("RootFolder",{ browseName: "MyDevice"});
```

##### add a variable

Adding a read-only variable inside the server namespace requires only a getter function.
This function returns a Variant containing the value of the variable to scan.

```javascript

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
```

Note that we haven't specified a NodeId for the variable.The server will automatically assign a new nodeId for us.

Let's create a more comprehensive Read-Write variable with a fancy nodeId

```javascript

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
```



Lets create a variable that expose the percentage of free memory on the running machine.

Let's write a small utility function that calculate this value.

```javascript
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
```

Now let's expose our OPCUA Variable

```javascript
server.nodeVariable3 = server.engine.addVariableInFolder("MyDevice", {
    nodeId: "ns=4;s=free_memory", // a string nodeID
    browseName: "FreeMemory",
    dataType: "Double",    
    value: {
        get: function () {return new opcua.Variant({dataType: opcua.DataType.Double, value: available_memory() });}
    }
});
```


### start the server

Once the server has been created and initialised, we use the **start** asynchronous method to let the server
initiate all its endpoints and start listening to clients.

```javascript
server.start(function() {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log("port ", server.endpoints[0].port);
    _"display endpoint url"
});
```

### display endpoint url

Once the server has been created and configured, it is possible to retrieve the endpoint url.

```javascript
var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
console.log(" the primary server endpoint url is ", endpointUrl );
```

## Execute and test the server

``` sh
$ node sample_server.js
```

