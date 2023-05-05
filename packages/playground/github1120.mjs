import {
    TimestampsToReturn,
    OPCUAServer,
    OPCUAClient,
    DataType,
    AttributeIds,
    constructEventFilter
} from "node-opcua";
(async () => {
    const server = new OPCUAServer({});

    await server.initialize();
    const addressSpace = server.engine.addressSpace;

    const namespace = addressSpace.getOwnNamespace();

    const area1 = namespace.addObject({
        browseName: "Area 1",
        notifierOf: addressSpace.rootFolder.objects.server,
        organizedBy: addressSpace.rootFolder.objects,
        eventNotifier: 1
    });
    const tankFarm = namespace.addObject({
        browseName: "Area 1",
        notifierOf: area1,
        organizedBy: area1,
        eventNotifier: 1
    });

    const tankA = namespace.addObject({
        browseName: "TankA",
        organizedBy: tankFarm,
        notifierOf: tankFarm,
        eventNotifier: 1
    });

    const tankLevel = namespace.addVariable({
        browseName: "TankLevel",
        nodeId: "s=TankLevel",
        componentOf: tankA,
        eventSourceOf: tankA, // "Tank A" -> HasEventSource -> "LevelMeasurement"
        dataType: DataType.Double,
        value: { dataType: "Double", value: 0.0 }
    });


    const alarm = namespace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
        browseName: "MyNonExclusiveLimitAlarm",
        conditionName: "MyNonExclusiveLimitAlarm",
        componentOf: tankA,

        conditionSource: tankLevel,
        conditionOf: tankA,

        highHighLimit: 190,
        highLimit: 180,
        inputNode: tankLevel,
        lowLimit: 40,
        lowLowLimit: 20
    });

    const timerId = setInterval(() => {
        const t = Date.now();
        const value = Math.sin(t / 10000) * 100 + 100;
        tankLevel.setValueFromSource({ dataType: "Double", value });
    }, 1000);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));
    await server.shutdown();
    console.log("Server has shut down");
})();

(async () => {
    const client = OPCUAClient.create({ endpointMustExist: false });

    client.on("backoff", () => console.log("keep trying to connect"));

    await client.withSubscriptionAsync(
        "opc.tcp://127.0.0.1:26543",
        { publishingEnabled: true, requestedPublishingInterval: 1000 },
        async (session, subscription) => {
            // const fields = await extractConditionFields(session, "AcknowledgeableConditionType");
            const fields = [
                "ActiveState.Id",
                // "EnabledState",
                // "AckedState",
                "Severity",
                "LowLowState.Id",
                "LowState.Id",
                "HighState.Id",
                "HighHighState.Id"
            ];
            // note: we may want to have this select clause
            //  Or(OfType("AcknowledgeableConditionType"), OfType("RefreshStartEventType"), OfType("RefreshEndEventType"))
            const eventFilter = constructEventFilter(fields);

            const monitoringParameters = {
                discardOldest: false,
                filter: eventFilter,
                queueSize: 100,
                samplingInterval: 0
            };

            const itemToMonitor = {
                attributeId: AttributeIds.EventNotifier,
                nodeId: "i=2253"
            };
            const monitoredItem = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Neither);
            monitoredItem.on("changed", (eventInfo) => {
                console.log("--------------------------------------------------");
                for (let i = 0; i < eventInfo.length; i++) {
                    if (eventInfo[i] && eventInfo[i].dataType !== DataType.Null) {
                        console.log(`${fields[i].padEnd(20)} = ${eventInfo[i].value.toString()}.`);
                    }
                }
            });
            const monitoredItem2 = await subscription.monitor(
                {
                    nodeId: "ns=1;s=TankLevel",
                    attributeId: AttributeIds.Value
                },
                { samplingInterval: 1000 },
                TimestampsToReturn.Both
            );
            monitoredItem2.on("changed", (dataValue) => {
                console.log("> Tank Level = ", dataValue.value.value);
            });

            await new Promise((resolve) => process.once("SIGINT", resolve));
        }
    );
})();
