import {
    Variant, AttributeIds, ofType, constructEventFilter, MonitoringMode, OPCUAClient, TimestampsToReturn
} from "node-opcua";

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

(async () => {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });
    try {
        await client.withSubscriptionAsync(endpointUrl, { publishingEnabled: true, requestedPublishingInterval: 1000 }, async (session, subscription) => {
            console.log("connected");



            const fields = ["EventType", "SourceName", "Time", "Message"];

            const eventFilter = constructEventFilter(fields, ofType("BaseEventType"));
            const monitoredItem = await subscription.monitor({
                nodeId: "ns=0;i=2253", // Server Object
                attributeId: AttributeIds.EventNotifier
            }, {
                queueSize: 10,
                filter: eventFilter,
            }, TimestampsToReturn.Both, MonitoringMode.Reporting);
            console.log("monitored item status", monitoredItem.statusCode.toString());

            monitoredItem.on("changed", (eventFields: Variant[]) => {
                // console.log("Event received: ", eventFields);
                // construct a structure that contains the event fields
                const event: Record<string, any> = {};
                for (let i = 0; i < fields.length; i++) {
                    event[fields[i]] = eventFields[i].value;
                }
                console.log("Event = ", event);
            });

            console.log("Ctrl + C to stop");
            await new Promise<void>((resolve) => process.on("SIGINT", resolve));

        });
        console.log("Done!")

    } catch (err) {
        console.log("Error = ", err);
    }
})();
