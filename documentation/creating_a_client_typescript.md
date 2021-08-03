# Creating a Client

In this example, we want to create a OPCUA Client to monitor a variable on the server, created in
[this tutorial](creating_a_server.md).

## preparation

- make sure node.js 8 or above is installed. Follow the instructions [here](http://nodejs.org/)).
- make sure also to install typescript version 3 or above

Let's create a node project for our client.

```shell
    $ mkdir sample_client_ts
    $ cd sample_client_ts
    $ npm init                      # creates a package.json
    $ npm install node-opcua-client --save
```

Now create and edit the sample file [sample_client_ts.ts](#overview-of-the-client-script "save:")

### overview of the client script

The script will be organised around the following four steps:


```javascript

_"declaration"

_"client instantiation"

_"setting up a series of asynchronous operations"

```

### declaration

```typescript
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  makeBrowsePath,
  ClientSubscription,
  TimestampsToReturn,
  MonitoringParametersOptions,
  ReadValueIdOptions,
  ClientMonitoredItem,
  DataValue
} from "node-opcua";
```

### client instantiation

To connect to the server, the client must specify the exact URI of the server, comprising hostname, port and OPCUA-endpoint.
**_ opc.tcp://opcuademo.sterfive.com:26543_**

where `opcuademo.sterfive.com` shall be replaced with the computer name or fully qualified domain name of the machine on which the
server is running.

### setting up a series of asynchronous operations

By default, the node-opcua client will continuously try to connect to the endpoint.
We may want here to customize the connection strategy, and caused the connect method
to fail after one single unsuccessful retry.

```typescript
const connectionStrategy = {
  initialDelay: 1000,
  maxRetry: 1
};
```

Let's use un-secure connection by setting securityMode to None and securityPolicy to None.

```typescript
const client = OPCUAClient.create({
  applicationName: "MyClient",
  connectionStrategy: connectionStrategy,
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpointMustExist: false
});
//const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";

```

We'll setup a skeleton for the general schedule of the clients life-cycle with placeholders for the actual functions. The `async.series` function will execute all tasks in order of their definition, so we can assume the connection is established before creating a session for example. After all tasks are done the client will disconnect.
_Note: read [this cookbook on async.series](http://www.sebastianseilund.com/nodejs-async-in-practice) if you do not know why it is a good idea to use this method._

```typescript

_"utility function"

async function main() {
  try {
    // step 1 : connect to
    _"Connection"

    // step 2 : createSession
    _"create session"

    // step 3 : browse
    _"browsing the root folder"

    // step 4 : read a variable with readVariableValue
    _"read a variable with readVariableValue"

    // step 4' : read a variable with read
    _"read a variable with read"

    // step 5: install a subscription and install a monitored item for 10 seconds
    _"install a subscription"

    // step 6: finding the nodeId of a node by Browse name
    _"finding the nodeId of a node by Browse name"

    // close session
    _"closing session"

    // disconnecting
    _"disconnecting"
  } catch(err) {
    console.log("An error has occured : ",err);
  }
}
main();
```

### Connection

```typescript
await client.connect(endpointUrl);
console.log("connected !");
```

### disconnecting

```typescript
await client.disconnect();
console.log("done !");
```

### create session

```typescript
const session = await client.createSession();
console.log("session created !");
```

### closing session

```typescript
await session.close();
```

### browsing the root folder

We can browse the `RootFolder` to receive a list of all of it's child nodes.
With the `references` object of the browseResult we are able to access all attributes.
Let's print the browseName of all the nodes.

```typescript
const browseResult = await session.browse("RootFolder");

console.log("references of RootFolder :");
for (const reference of browseResult.references) {
  console.log("   -> ", reference.browseName.toString());
}
```

### read a variable with read

To read a specific VariableType node we construct a `ReadValueId` object with the
two parameters `nodeId` and `attributeId` to tell the `read` function what we want it to do.
The first tells it the exact node, the latter which attribute we want to obtain.
The possible values provided by the SDK are enumerated within the `AttributeIds` enumeration.
Each field contains the OPC-UA compliant AttributeId that is defined by the OPC-UA standard.

```typescript
const maxAge = 0;
const nodeToRead = {
  nodeId: "ns=3;s=Scalar_Simulation_String",
  attributeId: AttributeIds.Value
};
const dataValue = await session.read(nodeToRead, maxAge);
console.log(" value ", dataValue.toString());
```

### read a variable with readVariableValue

It is also possible to directly access a variables value with it's `nodeId` through the
`readVariableValue` function.
See the [SDK reference](https://node-opcua.github.io/api_doc/) for more simplified access functions.

```typescript
const dataValue2 = await session.read({
  nodeId: "ns=1;s=free_memory",
  attributeId: AttributeIds.Value
});
console.log(" value = ", dataValue2.toString());
```

### finding the nodeId of a node by Browse name

If the `nodeId` is unknown it may be obtained through browsing for it.

```typescript
const browsePath = makeBrowsePath(
  "RootFolder",
  "/Objects/Server.ServerStatus.BuildInfo.ProductName"
);

const result = await session.translateBrowsePath(browsePath);
const productNameNodeId = result.targets[0].targetId;
console.log(" Product Name nodeId = ", productNameNodeId.toString());
```

### install a subscription

OPC-UA allows for subscriptions to it's objects instead of polling for changes. You'll create a
subscription from `session` with a parameter object. Next you'll define a Timeout for the
subscription to end and hook into several subscription events like `"started"`.
When defining an actual monitor object you again use the `nodeId` as well as the `attributeId`
you want to monitor. The monitor object again allows for hooks into it's event system.

```typescript
const subscription = ClientSubscription.create(session, {
  requestedPublishingInterval: 1000,
  requestedLifetimeCount: 100,
  requestedMaxKeepAliveCount: 10,
  maxNotificationsPerPublish: 100,
  publishingEnabled: true,
  priority: 10
});

subscription
  .on("started", function() {
    console.log(
      "subscription started for 2 seconds - subscriptionId=",
      subscription.subscriptionId
    );
  })
  .on("keepalive", function() {
    console.log("keepalive");
  })
  .on("terminated", function() {
    console.log("terminated");
  });

// install monitored item

const itemToMonitor: ReadValueIdOptions = {
  nodeId: "ns=1;s=free_memory",
  attributeId: AttributeIds.Value
};
const parameters: MonitoringParametersOptions = {
  samplingInterval: 100,
  discardOldest: true,
  queueSize: 10
};

const monitoredItem = ClientMonitoredItem.create(
  subscription,
  itemToMonitor,
  parameters,
  TimestampsToReturn.Both
);

monitoredItem.on("changed", (dataValue: DataValue) => {
  console.log(" value has changed : ", dataValue.value.toString());
});

await timeout(10000);

console.log("now terminating subscription");
await subscription.terminate();
```

### utility function

```javascript
async function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```
## Run the Client

```sh
$ ts-node sample_client_ts.ts
```

