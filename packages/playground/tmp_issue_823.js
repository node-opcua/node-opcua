const {
    OPCUAClient,
    ClientMonitoredItem,
    resolveNodeId,
    DataType,
    AttributeIds,
    TimestampsToReturn,
} = require("node-opcua");

const client = OPCUAClient.create({
    //  securityMode: 'None',
    // securityPolicy: 'None',

    endpointMustExist: false,
    // keepSessionAlive: true,

    connectionStrategy: {
        initialDelay: 2000,
        maxDelay: 10 * 1000,
        maxRetry: 10,
    },
});




const endpointUrl = "opc.tcp://localhost:48010";
const nodeId = "i=2258"; // Server_ServerStatus_CurrentTime";
(async () => {
    try {
        // step 1 : connect to
        await client.connect(endpointUrl);
        console.log('connected !');

        // step 2 : createSession
        const userIdentity = {}; // anonymous
        const session = await client.createSession();
        console.log('created session !');

        session.on('session_closed', (statusCode) => {
            console.log("session is closing ", statusCode.toString());
        });

        console.log("Creating a subscription");
        // create subscription

        const subscription = await session.createSubscription2({
            maxNotificationsPerPublish: 10,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 20,
            requestedPublishingInterval: 2000,
        });

        subscription.on('started', () => console.log('STARTED >>>>>> '));

        const itemToMonitor = {
            attributeId: AttributeIds.Value,
            nodeId
        };

        const monitoringParameters = {
            discardOldest: false,
            queueSize: 100,
            samplingInterval: 1000,
        };
        const monitoredItem = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);

        monitoredItem.on('error', (statusCode) => {
            console.log('Error= ', statusCode.toString());
        });
        monitoredItem.on('changed', function(value) {
            console.log("Id", this.monitoredItemId, ' New Value = ', value.toString());
        });

        console.log('-------------------------------------');
        process.on("SIGINT", async () => {
            // closing session
            await session.close(/* deleteSubscription*/ true);
            await client.disconnect();
            console.log('done!');
            process.exit(0);
        });
    }
    catch (err) {
        console.log("ERROR = ", err);
    }
})();
