import {
    AddressSpace,
    AttributeIds,
    ClientSession,
    ClientSidePublishEngine,
    ClientSubscription,
    DataChangeNotification,
    DataType,
    DataValue,
    ExtensionObject,
    MonitoredItemNotification,
    MonitoringMode,
    MonitoringParametersOptions,
    Namespace,
    NodeId,
    NodeIdLike,
    NotificationData,
    NotificationMessage,
    NumericRange,
    OPCUAClient,
    OPCUAClientOptions,
    ReadValueIdOptions,
    SetMonitoringModeRequest,
    SetMonitoringModeRequestOptions,
    SetMonitoringModeResponse,
    StatusCode,
    TimestampsToReturn,
    UInt32,
    VariantArrayType
} from "node-opcua";
import sinon = require("sinon");
import should = require("should");

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { itemsToMonitor1 } from "./_helpers_items_to_monitor";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

interface ClientSidePublishEnginePrivate extends ClientSidePublishEngine {
    internalSendPublishRequest(): void;
    suspend(suspend: boolean): void;
}
function getInternalPublishEngine(session: ClientSession): ClientSidePublishEnginePrivate {
    const s: ClientSidePublishEnginePrivate = (session as any).getPublishEngine();
    return s;
}
export function t(test: any) {
    const options: OPCUAClientOptions = {
        requestedSessionTimeout: 1000000
    };

    async function createSession() {
        const client = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;
        await client.connect(endpointUrl);
        const session = await client.createSession();

        const publishEngine = getInternalPublishEngine(session);
        publishEngine.timeoutHint = 1000000; // for debugging with ease !
        // make sure we control how PublishRequest are send
        publishEngine.suspend(true);

        // create a subscriptions
        const subscription = ClientSubscription.create(session, {
            publishingEnabled: true,
            requestedLifetimeCount: 200000,
            requestedMaxKeepAliveCount: 4,
            maxNotificationsPerPublish: 2,
            requestedPublishingInterval: 250
        });

        return { client, session, subscription, publishEngine };
    }
    interface Connection {
        client: OPCUAClient;
        session: ClientSession;
        subscription: ClientSubscription;
        publishEngine: ClientSidePublishEnginePrivate;
    }
    let s: Connection;
    async function waitForRawNotifications(): Promise<NotificationData[]> {
        const { publishEngine, subscription } = s;
        publishEngine.internalSendPublishRequest();
        return await new Promise((resolve: (result: NotificationData[]) => void) => {
            // wait for fist notification
            subscription.once("raw_notification", (notificationMessage: any) => {
                // tslint:disable-next-line: no-console
                debugLog("got notification message ", notificationMessage.toString());
                resolve(notificationMessage.notificationData);
            });
        });
    }
    async function waitForDataChangeNotification(): Promise<DataChangeNotification | null> {
        const rawNotification = await waitForRawNotifications();
        if (!rawNotification || rawNotification.length === 0) {
            return null;
        }
        if (rawNotification[0] instanceof DataChangeNotification) {
            return rawNotification[0] as DataChangeNotification;
        }
        return null;
    }
    async function waitForNotificationsValues(): Promise<{ value: number; statusCode: StatusCode }[]> {
        while (true) {
            const notificationData1 = await waitForRawNotifications();
            if (notificationData1.length > 0) {
                const dcn = notificationData1[0] as DataChangeNotification;
                const r = dcn.monitoredItems!.map((item: MonitoredItemNotification) => ({
                    statusCode: item.value.statusCode,
                    value: item.value.value.value
                }));
                return r;
            }
            // tslint:disable-next-line: no-console
            debugLog(" ------- skipping empty publish response");
            return [];
        }
    }

    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("Monitoring item tests", function (this: any) {
        this.timeout(Math.max(200000, this.timeout()));

        const items: NodeId[] = [];
        before(() => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const namespace = test.server.engine.addressSpace.getOwnNamespace() as Namespace;

            for (let i = 0; i < 10; i++) {
                const v = namespace.addVariable({
                    browseName: `SomeVariableForTest${i}`,
                    dataType: "UInt32"
                });
                v.setValueFromSource({ dataType: DataType.UInt32, value: 0 });
                items.push(v.nodeId);
            }
        });
        beforeEach(async () => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            s = await createSession();
        });
        afterEach(async () => {
            await s.subscription.terminate();
            await s.session.close();
            await s.client.disconnect();
        });

        let counter = 0;
        async function increaseVariables(session: ClientSession) {
            counter += 1;
            await session.write(
                items.map((nodeId) => ({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: new DataValue({ value: { dataType: DataType.UInt32, value: counter } })
                }))
            );
        }
        async function collectDataChange(memory: { [key: number]: DataValue }): Promise<number> {
            // wait one publishing cycle before calling publish
            let totalNumberOfDataChanges = 0;
            let dataChangeNotification = await waitForDataChangeNotification();
            while (dataChangeNotification) {
                totalNumberOfDataChanges += dataChangeNotification.monitoredItems?.length || 0;

                for (const c of dataChangeNotification.monitoredItems || []) {
                    memory[c.clientHandle] = c.value;
                }
                dataChangeNotification = await waitForDataChangeNotification();
            }
            return totalNumberOfDataChanges;
        }

        it("deleteMonitoredItem should remove dangling notifications", async () => {
            // we create a starving subscription (no publish request)
            // ( with maxNotificationsPerPublish = 2 so that all pending notifications are not send at once ... )
            // we create a monitoring item and make sure that the moninored Item change a lot
            // we delete the monitored item
            // we create the same monitored item
            // we send a publish request
            // we should verify that only one notification is recevied (for the only one valid monitored item )

            const { session, subscription, publishEngine } = s;

            let itemToMonitorsAll: ReadValueIdOptions[] = items.map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value }));

            const itemToMonitors1 = itemToMonitorsAll.slice(0, 5);

            const itemToMonitors2 = itemToMonitorsAll.slice(5);

            itemToMonitors1.length.should.eql(5);
            itemToMonitors2.length.should.eql(5);

            const requesterParameters: MonitoringParametersOptions = {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 0
            };
            await increaseVariables(session);
            const group = await subscription.monitorItems(itemToMonitors1, requesterParameters, TimestampsToReturn.Both);
            const change1 = await collectDataChange({});
            change1.should.eql(5);

            await increaseVariables(session);
            await new Promise((resolve) => setTimeout(resolve, 20));
            await increaseVariables(session);
            await new Promise((resolve) => setTimeout(resolve, 20));
            await increaseVariables(session);
            await new Promise((resolve) => setTimeout(resolve, 20));

            // get a partial notification , but do not go to completion
            let dataChangeNotification = await waitForDataChangeNotification();
            dataChangeNotification?.monitoredItems!.length.should.eql(2);

            await group.terminate();

            const group2 = await subscription.monitorItems(itemToMonitors2, requesterParameters, TimestampsToReturn.Both);
            const change2 = await collectDataChange({});
            change2.should.eql(5);
        });

        it("setMonitoringMode593011 wrong index range", async () => {
            // the test modifies the monitoring mode of 10 items (initial monitoring mode: reporting)
            // with multiple items being set to each of the three modes (Disabled, Reporting, Sampling)
            // calls publish before and after changing the mode and verifies that datachange notifications
            // are received only for the reporting items.

            const { session, subscription, publishEngine } = s;

            const itemsValues: { [key: number]: DataValue } = {};

            let counter = 0;

            // The 10 items used for this test. The test can use the same NodeIds,

            await increaseVariables(session);

            let itemToMonitors: ReadValueIdOptions[] = items.map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value }));

            const requesterParameters: MonitoringParametersOptions = {
                discardOldest: true,
                queueSize: 1,
                samplingInterval: 1
            };
            const group = await subscription.monitorItems(itemToMonitors, requesterParameters, TimestampsToReturn.Both);

            const totalNumberOfDataChanges = await collectDataChange(itemsValues);

            // Make sure we received datachange notification - should contain INITIAL values
            totalNumberOfDataChanges.should.eql(10);

            // Now change the monitoring mode as below:
            // Disabled: 3 (indices 0,4,6 in createMonitoredItemsResponse)
            // Sampling: 3 (indices 2,8,9 in createMonitoredItemsResponse)
            // Reporting: 4 (indices 1,3,5,7 in createMonitoredItemsResponse)
            console.log("Changing monitoring mode for the items.");

            const monitoredItems = await subscription.getMonitoredItems();
            // i=0: DISABLED; i=1: SAMPLING; i=2: REPORTING
            for (let i = 0; i < 3; i++) {
                const setMonitoringModeRequest = new SetMonitoringModeRequest({
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: MonitoringMode.Disabled,
                    monitoredItemIds: []
                });
                if (!setMonitoringModeRequest.monitoredItemIds) {
                    throw new Error("Internal");
                }
                switch (i) {
                    // DISABLED
                    case 0:
                        setMonitoringModeRequest.monitoringMode = MonitoringMode.Disabled;
                        // Items
                        setMonitoringModeRequest.monitoredItemIds[0] = monitoredItems.serverHandles[0];
                        setMonitoringModeRequest.monitoredItemIds[1] = monitoredItems.serverHandles[4];
                        setMonitoringModeRequest.monitoredItemIds[2] = monitoredItems.serverHandles[6];
                        break;

                    // SAMPLING
                    case 1:
                        setMonitoringModeRequest.monitoringMode = MonitoringMode.Sampling;
                        // Items
                        setMonitoringModeRequest.monitoredItemIds[0] = monitoredItems.serverHandles[2];
                        setMonitoringModeRequest.monitoredItemIds[1] = monitoredItems.serverHandles[8];
                        setMonitoringModeRequest.monitoredItemIds[2] = monitoredItems.serverHandles[9];
                        break;

                    // REPORTING
                    case 2:
                        setMonitoringModeRequest.monitoringMode = MonitoringMode.Reporting;
                        // Items
                        setMonitoringModeRequest.monitoredItemIds[0] = monitoredItems.serverHandles[1];
                        setMonitoringModeRequest.monitoredItemIds[1] = monitoredItems.serverHandles[3];
                        setMonitoringModeRequest.monitoredItemIds[2] = monitoredItems.serverHandles[5];
                        setMonitoringModeRequest.monitoredItemIds[3] = monitoredItems.serverHandles[7];
                        break;
                    default:
                        throw new Error(
                            "Unexpected error. Unable to specify the monitoringMode request. Test script implementation problem!"
                        );
                }

                const setMonitoringModeResponse = (await (session as any).setMonitoringMode(
                    setMonitoringModeRequest
                )) as SetMonitoringModeResponse;

                //xx checkSetMonitoringModeValidParameter( setMonitoringModeRequest, setMonitoringModeResponse );

                switch (i) {
                    // DISABLED
                    case 0:
                        console.log("Monitoring mode set to 'Disabled' successfully for 3 items.");
                        break;
                    // SAMPLING
                    case 1:
                        console.log("Monitoring mode set to 'Sampling' successfully for 3 items.");
                        break;
                    // REPORTING
                    case 2:
                        console.log("Monitoring mode set to 'Reporting' successfully for 4 items.");
                        break;
                    default:
                        throw new Error("Unexpected error. Verification implementation problem in test-script.");
                }

                // Write to ALL items, incl. those that are disabled etc.
                for (let x = 0; x < items.length; x++) {
                    // if( Assert.True( WriteHelper.Execute( { NodesToWrite: items } ), "This test requires the ability to Write to the Nodes in order to achieve a value change in the item so that the Publish call can receive a dataChange notification." ) ) {
                    //     // call Publish() again to verify that we receive datachange notification only for 4 items
                    //     // wait one publishing cycle before calling publish
                    //     PublishHelper.WaitInterval( { Items: items, Subscription: MonitorBasicSubscription } );
                    //     addLog ( "Calling publish again. We should receivse NotificationData this time only for 4 items." );
                    //     PublishHelper.Execute();
                    //     // Make sure we received datachange notification
                    //     if( Assert.Equal( true, PublishHelper.CurrentlyContainsData(), "NotificationData not received (second publish call) when expected for the 4 'Reporting' monitored items", "Publish() #2 correctly received the dataChange notifications as expected." ) ) {
                    //         TotalNumberOfDataChanges = PublishHelper.CurrentDataChanges[0].MonitoredItems.length;
                    //         while (PublishHelper.Response.MoreNotifications == true) {
                    //             PublishHelper.Execute();
                    //             TotalNumberOfDataChanges += PublishHelper.CurrentDataChanges[0].MonitoredItems.length;
                    //         }
                    //         // Check that notification was received only for 4 items
                    //         if( Assert.Equal( 4, TotalNumberOfDataChanges, ( "Datachange notification received for " + PublishHelper.CurrentDataChanges[0].MonitoredItems.length + " items when expected for 4 items" ), "Publish() #2 received the 4 dataChange notifications as expected, since the other 6 monitoredItems are set to Disabled/Sampling." ) )
                    //         {
                    //             var expectedItems = [1, 3, 5, 7 ];
                    //             for( x=0; x<expectedItems.length; x++ ) Assert.True( PublishHelper.HandleIsInCurrentDataChanges( items[expectedItems[x]].ClientHandle ), ( "Expected item[" + expectedItems[x] + "] (Node: " + items[expectedItems[x]].NodeSetting + ") to send an update." ), "Item[" + expectedItems[x] + "] successfully received a dataChange notification. Mode=" + MonitoringMode.toString( items[x].MonitoringMode ) );
                    //         }
                    //     }
                    // }
                }
            }
        });

        it("createMonitoredItems591025 ", async () => {
            /* 
            Specify an item of type array. Do this for all configured supported data types.
            
            Specify an IndexRange that equates to the last 3 elements of the array.

            Write values to each data-type within the index range specified and then 
            call Publish(). 
            
            We expect to receive data in the Publish response.

            Write to each data-type outside of the index range (e.g. elements 0 and 1) and then call Publish().

            We do not expect to receive data in the Publish response. 
            */
            const { session, subscription, publishEngine } = s;

            const namespaceSimulationIndex = 2;

            const nodeId = `ns=${namespaceSimulationIndex};s=Static_Array_UInt32`;

            let valueRankDataValue = await session.read({ nodeId, attributeId: AttributeIds.ValueRank });
            const valueRank = valueRankDataValue.value.value as number;
            valueRank.should.eql(1);
            let dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
            const nbElements = (dataValue.value.value as UInt32[]).length;

            const newValue = [];
            for (let i = 0; i < nbElements; i++) {
                newValue[i] = i;
            }

            dataValue.value.value = newValue;
            await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: dataValue
            });

            let itemsToMonitor: ReadValueIdOptions[] = [
                {
                    nodeId,
                    attributeId: AttributeIds.Value,
                    indexRange: new NumericRange(nbElements - 3, nbElements - 1)
                }
            ];

            const requesterParameters: MonitoringParametersOptions = {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 0
            };
            const group = await subscription.monitorItems(itemsToMonitor, requesterParameters, TimestampsToReturn.Both);

            const d: any = {};
            const change1 = await collectDataChange(d);
            change1.should.eql(1);

            console.log(d["1"].toString());


            await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                indexRange: new NumericRange(nbElements - 3, nbElements - 1),
                value: {  
                    value: {
                        dataType: DataType.UInt32, 
                        arrayType: VariantArrayType.Array, 
                        value: [70,80,90] 
                    }
                }
            });

            const change2 = await collectDataChange(d);
            change2.should.eql(1);

            
            await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                indexRange: new NumericRange(0, 2),
                value: {  
                    value: {
                        dataType: DataType.UInt32, 
                        arrayType: VariantArrayType.Array, 
                        value: [1000,10001, 10002] 
                    }
                }
            });

            const change3 = await collectDataChange(d);
            change3.should.eql(0);

            dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
            console.log(dataValue.toString());

        });
    });
}
