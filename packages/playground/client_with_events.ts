import {
    AttributeIds,
    OPCUAClient,
    DataType,
    extractConditionFields,
    resolveNodeId,
    constructEventFilter,
    ofType,
    TimestampsToReturn,
    ContentFilter,
    MonitoringMode,
    Variant
} from "node-opcua-client";

const endpointUrl = "opc.tcp://185.164.5.140:48401";
const nodeId = "ns=2;s=179";
// const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
// const nodeId1 = "i=2253";


async function main() {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });

    client.on("backoff", (n, delay) => {
        console.log("cannot connect to ", endpointUrl, "(repeated ", n, "times), will retry in ", delay, "ms");
    });
    await client.withSubscriptionAsync(
        endpointUrl,
        {
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 1000,
            maxNotificationsPerPublish: 10
        },
        async (session, subscription) => {
            
            const dv = await session.read({nodeId: "i=2258", attributeId: AttributeIds.Value});
            console.log("Value = ", dv.toString());

            console.log("subscription created", subscription.toString());

            try {
                if (false) {
                    const m2 = await subscription.monitor(
                        {
                            nodeId: "i=2258",
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 100
                        },
                        TimestampsToReturn.Both,
                        MonitoringMode.Reporting
                    );
                    m2.on("changed", (dataValue) => {
                        console.log("Value = ", dataValue.value.toString());
                    });
                    console.log("statusCode ", m2.statusCode.toString());
                    console.log("Monitoring  result", m2.result?.toString());
                }
                console.log("Connected");
               
               
                const fields = await extractConditionFields(session, "AcknowledgeableConditionType");

                const AcknowledgeableConditionType = resolveNodeId("AcknowledgeableConditionType");

                //  const eventFilter = constructEventFilter(fields, ofType(AcknowledgeableConditionType));
                const eventFilter = constructEventFilter(fields, ofType("BaseEventType"));

                // For some reason the Python server does'nt support whereClauses ... 
                // we should not use them, and let them empty
                eventFilter.whereClause = new ContentFilter({});

                const monitoredItem = await subscription.monitor(
                    {
                        nodeId,
                        attributeId: AttributeIds.EventNotifier
                    },
                    {
                        filter: eventFilter,
                        discardOldest: true,
                        queueSize: 10,
                        samplingInterval: 0
                    },
                    TimestampsToReturn.Both,
                    MonitoringMode.Reporting
                );
                console.log("statusCode ", monitoredItem.statusCode.toString());
                console.log("Monitoring  result", monitoredItem.result?.toString());
                monitoredItem.on("changed", (eventFields: Variant[]) => {
                    console.log("Event received: ");
                    eventFields.forEach((f, index) => {
                        if (eventFields[index].dataType != DataType.Null) {
                            console.log("   ", fields[index].padEnd(23, " "), eventFields[index].toString());
                        }
                    });
                });
            } catch (err) {
                console.log("Error: ", err);
            }

            await new Promise((resolve) => process.once("SIGINT", resolve));
        }
    );
    console.log("disconnected");
}
main();
