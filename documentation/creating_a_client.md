
# Creating a Client

In this example, we want to create a OPCUA Client to monitor a variable on a Server.


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


## the client script

Now edit the [sample_client.js](#the client script "save: | jshint ") script.

The script will be organised around the following four steps:

    _"declaration"

    _"client instantiation"

    _"setting up an series of asynchronous operation"



### declaration

```javascript
var opcua = require("node-opcua");
var async = require("async");
```

### client instantiation

```javascript
var client = new opcua.OPCUAClient();
var endpointUrl = "opc.tcp://" + require("os").hostname().toLowerCase() + ":4334/UA/SampleServer";
```


### setting up an series of asynchronous operation

```javascript

var the_session = null;
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

    // step 4 : read a variable
    function(callback) {
       _"read a variable"
    },

    // step 5: install a subscription and install a monitored item for 10 seconds
    function(callback) {
       _"install a subscription"
    },

    // close session
    function(callback) {
        _"closing session"
    },

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
    callback();
});
```

### browsing the root folder

```javascript
the_session.browse("RootFolder", function(err,browse_result){
    if(!err) {
        browse_result[0].references.forEach(function(reference) {
            console.log( reference.browseName);
        });
    }
    callback(err);
});
```


### read a variable

```javascript
the_session.readVariableValue("ns=4;s=free_memory", function(err,dataValues,diagnostics) {
    if (!err) {
        console.log(" free mem % = " , dataValues);
    }
    callback(err);
});
```

### finding the nodeId of a node by Browse name

to do


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
    nodeId: opcua.resolveNodeId("ns=4;s=free_memory"),
    attributeId: 13
},
{
    samplingInterval: 100,
    discardOldest: true,
    queueSize: 10
});
console.log("-------------------------------------");

monitoredItem.on("changed",function(dataValue){
   console.log(" % free mem = ",dataValue.value.value);
});
```

## Run the server

``` sh
    $ node sample_client
```

