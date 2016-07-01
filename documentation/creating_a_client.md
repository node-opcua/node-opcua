
# Creating a Client

In this example, we want to create a OPCUA Client to monitor a variable on the server , created in
[this tutorial](creating_a_server.md).

## preparation

* (note: please make sure node.js is installed. Follow the instructions [here](http://nodejs.org/) ).


Let's create a node project for our server.

``` shell
    $ mkdir sample_client
    $ cd sample_client
    $ npm init                      # create a package.json
    $ npm install node-opcua --save
    $ npm install async --save
```

Now edit the sample file [sample_client.js](#the-client-script "save:")

### the client script


The script will be organised around the following four steps:

    _"declaration"

    _"client instantiation"

    _"setting up an series of asynchronous operation"



### declaration

```javascript
/*global require,console,setTimeout */
var opcua = require("node-opcua");
var async = require("async");
```

### client instantiation

To connect to the server, the client must specify the exact URI of the server.
<pre>
opc.tcp://<hostname>:4334/UA/MyLittleServer
</pre>
where <hostname> shall be replaced with the computer name or fully qualified domain name of the machine on which the
server is running.
OPCUA Client



```javascript
var client = new opcua.OPCUAClient();
var endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";
```


### setting up an series of asynchronous operation

```javascript

var the_session, the_subscription;

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
client.connect(endpointUrl,function (err) {
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
client.createSession( function(err,session) {
    if(!err) {
        the_session = session;
    }
    callback(err);
});
```

### closing session

```javascript
the_session.close(function(err){
    if(err) {
        console.log("session closed failed ?");
    }
    callback();
});
```

### browsing the root folder

```javascript
the_session.browse("RootFolder", function(err,browse_result){
    if(!err) {
        browse_result[0].references.forEach(function(reference) {
            console.log( reference.browseName.toString());
        });
    }
    callback(err);
});
```


### read a variable with read

```javascript
var max_age = 0;
var nodes_to_read = [
   { nodeId: "ns=1;s=free_memory", attributeId: opcua.AttributeIds.Value } 
];
the_session.read(nodes_to_read, max_age, function(err,nodes_to_read,dataValues) {
    if (!err) {
        console.log(" free mem % = " , dataValues[0]);
    }
    callback(err);
});


```

### read a variable with readVariableValue

```javascript
the_session.readVariableValue("ns=1;s=free_memory", function(err,dataValue) {
    if (!err) {
        console.log(" free mem % = " , dataValue.toString());
    }
    callback(err);
});


```

### finding the nodeId of a node by Browse name

```javascript
var browsePath = [
    opcua.browse_service.makeBrowsePath("RootFolder","/Objects/Server.ServerStatus.BuildInfo.ProductName"),
];

var productNameNodeId;
the_session.translateBrowsePath(browsePath, function (err, results) {
    if (!err) {
      console.log(results[0].toString());
      productNameNodeId = results[0].targets[0].targetId;
    }
});

```


### install a subscription

```javascript

the_subscription=new opcua.ClientSubscription(the_session,{
    requestedPublishingInterval: 1000,
    requestedLifetimeCount: 10,
    requestedMaxKeepAliveCount: 2,
    maxNotificationsPerPublish: 10,
    publishingEnabled: true,
    priority: 10
});

the_subscription.on("started",function(){
    console.log("subscription started for 2 seconds - subscriptionId=",the_subscription.subscriptionId);
}).on("keepalive",function(){
    console.log("keepalive");
}).on("terminated",function(){
    callback();
});

setTimeout(function(){
    the_subscription.terminate();
},10000);

// install monitored item
var monitoredItem  = the_subscription.monitor({
    nodeId: opcua.resolveNodeId("ns=1;s=free_memory"),
    attributeId: opcua.AttributeIds.Value
},
{
    samplingInterval: 100,
    discardOldest: true,
    queueSize: 10
},
opcua.read_service.TimestampsToReturn.Both
);
console.log("-------------------------------------");

monitoredItem.on("changed",function(dataValue){
   console.log(" % free mem = ",dataValue.value.value);
});
```

## Run the Client

``` sh
    $ node sample_client
```

