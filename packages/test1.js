
const opcua = require("./node-opcua");

//const heapdump  = require("heapdump");

const endpointUrl = "opc.tcp://localhost:26544";
// 192.168.43.229
async function cycle() {
    //xx await heapdump.writeSnapshot();

    let client = opcua.OPCUAClient.create({
        endpointMustExist:false
    });
    await client.connect(endpointUrl);

    let session = await client.createSession();

    let subscription = opcua.ClientSubscription.create(session,{
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 10000,
        requestedMaxKeepAliveCount: 200,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
    });

    subscription.on("started",()=>console.log("started"));

    let monitoredItems = [];

    const itemToMinitor = {
        nodeId: opcua.resolveNodeId("ns=1;s=Temperature"),
        attributeId: opcua.AttributeIds.Value
    };

    const monitoringParameters= {
        samplingInterval: 10,
        discardOldest:    true,
        queueSize:        1000
    };

    const monitoredItem = opcua.ClientMonitoredItem.create(
        subscription,
        itemToMinitor,monitoringParameters,opcua.TimestampsToReturn.Both);

    monitoredItem.on("changed",function(dataValue) {
        //console.log("D = s",dataValue.toString())
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    await subscription.terminate();
    //xx let subscription = await session.createSubscription({
    //xx     requestedPublishingInterval: 1000,
    //xx     requestedLifetimeCount: 1000,
    //xx     maxNotificationsPerPublish: 100,
    //xx     requestedMaxKeepAliveCount: 50
    //xx });
    console.log("))");

    await session.close();

    await client.disconnect();

    client = null;
    //xx await heapdump.writeSnapshot();

}
(async () => {
    //xx  global.gc(true);


    for (let i =0;i<1000;i++) {
        global.gc(true);
        await cycle();
    }
    //xx  global.gc(true);

})();

