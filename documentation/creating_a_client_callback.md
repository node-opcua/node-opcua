# Creating a Client

In this example, we want to create a OPCUA Client to monitor a variable on the server, created in
[this tutorial](creating_a_server.md).

### Note

This tutorial is using the legacy callback method which has been superceeded by the async/await method that provides a nicer and cleaner technique.

Please refer to the typescript version here [create a client typescript](creating_a_client_typescript.md)

you've been warned !

## preparation

- (note: please make sure node.js is installed. Follow the instructions [here](http://nodejs.org/)).

Let's create a node project for our client.

```shell
$ mkdir sample_client
$ cd sample_client
$ npm init                      # creates a package.json
$ npm install node-opcua --save
$ npm install async --save
```

Now create and edit the sample file [sample_client.js](#overview-of-the-client-script "save:")



### overview of the client script

The script will be organised around the following four steps:

```javascript
    _"declaration"

    _"client instantiation"

    _"setting up a series of asynchronous operations"
```

### declaration

```javascript
const { OPCUAClient, makeBrowsePath, AttributeIds, resolveNodeId, TimestampsToReturn} = require("node-opcua");
const async = require("async");
```

### client instantiation

To connect to the server, the client must specify the exact URI of the server, comprising hostname, port and OPCUA-endpoint.

```javascript
// const endpointUrl = "opc.tcp://<hostname>:4334/UA/MyLittleServer";
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";
```

where `<hostname>` shall be replaced with the computer name or fully qualified domain name of the machine on which the
server is running. `UA/MyLittleServer` is the endpoint defined by the server and also has to be replaced by an existing endpoint on that server.

```javascript
const client = OPCUAClient.create({
    endpointMustExist: false
});
_"adding some helpers to diagnose connection issues"
```

> Note that by default, the `endpointUrl` must match the url exposed by the server, this means that `<hostname>` cannot be replaced by
> an hostname alias or a straight ip address. To relax this restriction, one can use the `endpointMustExist: false`
> option when creating the OPUA Client

### adding some helpers to diagnose connection issues

It is possible to get a idea of the connection progress by adding a event handled on the "backoff".
The backoff event is raised when the client failed to connect to the server and indicates that it will retry later.

```javascript
client.on("backoff", (retry, delay) =>
  console.log(
    "still trying to connect to ",
    endpointUrl,
    ": retry =",
    retry,
    "next attempt in ",
    delay / 1000,
    "seconds"
  )
);
```

### setting up a series of asynchronous operations

We'll setup a skeleton for the general schedule of the clients life-cycle with placeholders for the actual functions. The `async.series` function will execute all tasks in order of their definition, so we can assume the connection is established before creating a session for example. After all tasks are done the client will disconnect.

_Note: read [this cookbook on async.series](http://www.sebastianseilund.com/nodejs-async-in-practice) if you do not know why it is a good idea to use this method._

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
    function(callback) {
       _"add some monitored items"
    },
    function(callback) {
        // wait a little bit : 10 seconds
        setTimeout(()=>callback(), 10*1000);
    },
    // terminate session
    function(callback) {
        _"stopping subscription";
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
client.connect(endpointUrl, function(err) {
  if (err) {
    console.log(" cannot connect to endpoint :", endpointUrl);
  } else {
    console.log("connected !");
  }
  callback(err);
});
```

### create session

```javascript
client.createSession(function(err, session) {
  if (err) {
    return callback(err);
  }
  the_session = session;
  callback();
});
```

### closing session

```javascript
the_session.close(function(err) {
  if (err) {
    console.log("closing session failed ?");
  }
  callback();
});
```

### browsing the root folder

We can browse the `RootFolder` to receive a list of all of it's child nodes. With the `references` object of the browseResult we are able to access all attributes. Let's print the browseName of all the nodes.

```javascript
the_session.browse("RootFolder", function(err, browseResult) {
  if (!err) {
    console.log("Browsing rootfolder: ");
    for (let reference of browseResult.references) {
      console.log(reference.browseName.toString(), reference.nodeId.toString());
    }
  }
  callback(err);
});
```

### read a variable with read

To read a specific VariableType node we construct a `nodeToRead` object with the two parameters `nodeId` and `attributeId` to tell the `read` function what we want it to do. The first tells it the exact node, the latter which attribute we want to obtain. The possible values provided by the SDK are enumerated within the `AttributeIds` object. Each field contains the OPC-UA complient AttributeId that is defined by the OPC-UA standard.

```javascript
const maxAge = 0;
const nodeToRead = {
  nodeId: "ns=1;s=free_memory",
  attributeId: AttributeIds.Value
};

the_session.read(nodeToRead, maxAge, function(err, dataValue) {
  if (!err) {
    console.log(" free mem % = ", dataValue.toString());
  }
  callback(err);
});
```

### read a variable with readVariableValue

It is also possible to directly access a variables value with it's `nodeId` through the `readVariableValue` function. See the [SDK reference](https://node-opcua.github.io/api_doc/) for more simplified access functions.

```javascript
the_session.read({nodeId: "ns=1;s=free_memory", attributeId: AttributeIds.Value}, (err, dataValue) => {
  if (!err) {
    console.log(" free mem % = ", dataValue.toString());
  }
  callback(err);
});
```

### finding the nodeId of a node by Browse name

If the `nodeId` is unkown it may be obtained through browsing for it.

```javascript
const browsePath = [
  makeBrowsePath(
    "RootFolder",
    "/Objects/Server.ServerStatus.BuildInfo.ProductName"
  )
];

let productNameNodeId;
the_session.translateBrowsePath(browsePath, function(err, results) {
  if (!err) {
    console.log(results[0].toString());
    productNameNodeId = results[0].targets[0].targetId;
  }
});
```

### install a subscription

OPC-UA allows for subscriptions to it's objects instead of polling for changes. You'll create a subscription from `the_session` with a parameter object. Next you'll define a Timeout for the subscription to end and hook into several subscription events like `"started"`. When defining an actual monitor object you again use the `nodeId` as well as the `attributeId` you want to monitor. The monitor object again allows for hooks into it's event system.

```javascript
const subscriptionOptions = {
  maxNotificationsPerPublish: 1000,
  publishingEnabled: true,
  requestedLifetimeCount: 100,
  requestedMaxKeepAliveCount: 10,
  requestedPublishingInterval: 1000
};
the_session.createSubscription2(subscriptionOptions, (err, subscription) => {
  if (err) {
    return callback(err);
  }

  the_subscription = subscription;

  the_subscription
    .on("started", () => {
      console.log(
        "subscription started for 2 seconds - subscriptionId=",
        the_subscription.subscriptionId
      );
    })
    .on("keepalive", function() {
      console.log("subscription keepalive");
    })
    .on("terminated", function() {
      console.log("terminated");
    });
  callback();
});
```

### add some monitored items

```javascript
// install monitored item
const itemToMonitor = {
  nodeId: resolveNodeId("ns=1;s=free_memory"),
  attributeId: AttributeIds.Value
};
const monitoringParamaters = {
  samplingInterval: 100,
  discardOldest: true,
  queueSize: 10
};

the_subscription.monitor(
  itemToMonitor,
  monitoringParamaters,
  TimestampsToReturn.Both,
  (err, monitoredItem) => {
    monitoredItem.on("changed", function(dataValue) {
      console.log(
        "monitored item changed:  % free mem = ",
        dataValue.value.value
      );
    });
    callback();
  }
);
console.log("-------------------------------------");
```

## stopping subscription

```javascript
the_subscription.terminate(callback);
```

## Run the Client

```sh
$ node sample_client
```

