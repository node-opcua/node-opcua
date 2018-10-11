
# Creating a Client

In this example, we want to create a OPCUA Client to monitor a variable on the server, created in
[this tutorial](creating_a_server.md).

## preparation

* (note: please make sure node.js is installed. Follow the instructions [here](http://nodejs.org/)).


Let's create a node project for our client.

``` shell
    $ mkdir sample_client
    $ cd sample_client
    $ npm init                      # creates a package.json
    $ npm install node-opcua --save
    $ npm install async --save
```

Now create and edit the sample file [sample_client.js](#the-client-script "save:")

### overview of the client script

The script will be organised around the following four steps:

    _"declaration"

    _"client instantiation"

    _"setting up a series of asynchronous operations"



### declaration

```javascript
/*global require,console,setTimeout */
const opcua = require("node-opcua");
const async = require("async");
```

### client instantiation

To connect to the server, the client must specify the exact URI of the server, comprising hostname, port and OPCUA-endpoint.
```
opc.tcp://<hostname>:4334/UA/MyLittleServer
```
where `<hostname>` shall be replaced with the computer name or fully qualified domain name of the machine on which the
server is running. `UA/MyLittleServer` is the endpoint defined by the server and also has to be replaced by an existing endpoint on that server.

### OPCUA Client

```javascript
const client = new opcua.OPCUAClient();
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";
```

### setting up a series of asynchronous operations

We'll setup a skeleton for the general schedule of the clients life-cycle with placeholders for the actual functions. The `async.series` function will execute all tasks in order of their definition, so we can assume the connection is established before creating a session for example. After all tasks are done the client will disconnect.

*Note: read [this cookbook on async.series](http://www.sebastianseilund.com/nodejs-async-in-practice) if you do not know why it is a good idea to use this method.*

```javascript

let the_session, the_subscription;

async.series([

    // step 1 : connect to
    function(callback)  {
        _"Connection"
    },

    // step 2 : createSession
    function(callback) {
        _"create session"
    },

    // step 3 : browse
    function(callback) {
       _"browsing the root folder"
    },

    // step 4 : read a variable with readVariableValue
    function(callback) {
       _"read a variable with readVariableValue"
    },
    
    // step 4' : read a variable with read
    function(callback) {
       _"read a variable with read"
    },
    
    // step 5: install a subscription and install a monitored item for 10 seconds
    function(callback) {
       _"install a subscription"
    },

    // close session
    function(callback) {
        _"closing session"
    }

],
function(err) {
    if (err) {
        console.log(" failure ",err);
    } else {
        console.log("done!");
    }
    client.disconnect(function(){});
}) ;
```


### Connection

```javascript
client.connect(endpointUrl, function (err) {
    if(err) {
        console.log(" cannot connect to endpoint :" , endpointUrl );
    } else {
        console.log("connected !");
    }
    callback(err);
});
```

### create session

```javascript
client.createSession( function(err, session) {
    if(!err) {
        the_session = session;
    }
    callback(err);
});
```

### closing session

```javascript
the_session.close( function(err) {
    if(err) {
        console.log("closing session failed ?");
    }
    callback();
});
```

### browsing the root folder

We can browse the `RootFolder` to receive a list of all of it's child nodes. With the `references` object of the browseResult we are able to access all attributes. Let's print the browseName of all the nodes.

```javascript
the_session.browse("RootFolder", function(err, browseResult) {
    if(!err) {
        browseResult.references.forEach( function(reference) {
            console.log( reference.browseName.toString());
        });
    }
    callback(err);
});
```

### read a variable with read

To read a specific VariableType node we construct a `nodeToRead` object with the two parameters `nodeId` and `attributeId` to tell the `read` function what we want it to do. The first tells it the exact node, the latter which attribute we want to obtain. The possible values provided by the SDK are enumerated within the `opcua.AttributeIds` object. Each field contains the OPC-UA complient AttributeId that is defined by the OPC-UA standard.

```javascript
const maxAge = 0;
const nodeToRead = { nodeId: "ns=1;s=free_memory", attributeId: opcua.AttributeIds.Value };

the_session.read(nodeToRead, maxAge, function(err, dataValue) {
    if (!err) {
        console.log(" free mem % = " , dataValue.toString());
    }
    callback(err);
});
```

### read a variable with readVariableValue

It is also possible to directly access a variables value with it's `nodeId` through the `readVariableValue` function. See the [SDK reference](https://node-opcua.github.io/api_doc/) for more simplified access functions.

```javascript
the_session.readVariableValue("ns=1;s=free_memory", function(err, dataValue) {
    if (!err) {
        console.log(" free mem % = " , dataValue.toString());
    }
    callback(err);
});
```

### finding the nodeId of a node by Browse name

If the `nodeId` is unkown it may be obtained through browsing for it.

```javascript
const browsePath = [
    opcua.makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus.BuildInfo.ProductName"),
];

let productNameNodeId;
the_session.translateBrowsePath(browsePath, function (err, results) {
    if (!err) {
      console.log(results[0].toString());
      productNameNodeId = results[0].targets[0].targetId;
    }
});

```

### install a subscription

OPC-UA allows for subscriptions to it's objects instead of polling for changes. You'll create a subscription from `the_session` with a parameter object. Next you'll define a Timeout for the subscription to end and hook into several subscription events like `"started"`. When defining an actual monitor object you again use the `nodeId` as well as the `attributeId` you want to monitor. The monitor object again allows for hooks into it's event system.

```javascript

the_subscription=new opcua.ClientSubscription(the_session, {
    requestedPublishingInterval: 1000,
    requestedLifetimeCount:     100,
    requestedMaxKeepAliveCount: 10,
    maxNotificationsPerPublish: 100,
    publishingEnabled: true,
    priority: 10
});

the_subscription.on("started", function() {
    console.log("subscription started for 2 seconds - subscriptionId=",the_subscription.subscriptionId);
}).on("keepalive", function() {
    console.log("keepalive");
}).on("terminated", function() {
   console.log("terminated");
});

setTimeout( function() {
    the_subscription.terminate(callback);
}, 10000);

// install monitored item
const monitoredItem  = the_subscription.monitor({
        nodeId: opcua.resolveNodeId("ns=1;s=free_memory"),
        attributeId: opcua.AttributeIds.Value
    },
    {
        samplingInterval: 100,
        discardOldest: true,
        queueSize: 10
    },
    opcua.TimestampsToReturn.Both
);
console.log("-------------------------------------");

monitoredItem.on("changed", function(dataValue) {
   console.log(" % free mem = ", dataValue.value.value);
});
```

## Run the Client

``` sh
    $ node sample_client
```

