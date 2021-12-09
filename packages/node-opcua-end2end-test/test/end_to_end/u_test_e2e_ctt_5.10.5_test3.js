/**
 Description:
 Script calls republish multiple X times, to obtain the last 3 X updates. The script accomplished this by:
 - create subscription/monitor items
 - call Publish() first time to get sequence number
 - send ack to the first sequence no. we received (only once in this loop)
 - repeat three times
 -    * write value
 -    * call Publish()
 -    * save received NotificationMessage and sequence number. Don't acknowledge.
 - repeat three times
 -    * call republish, with the saved sequence numbers from above (in the same order)
 -    * compare the published NotificationMessage to the republished NotificationMessage (should equal).
 */

const { assert } = require("node-opcua-assert");
const should = require("should");
const sinon = require("sinon");
const opcua = require("node-opcua");
const chalk = require("chalk");

const {
    OPCUAClient,
    ClientSubscription
} = opcua;

const doDebug = false;

const {
    perform_operation_on_subscription_async
} = require("../../test_helpers/perform_operation_on_client_session");

function f(func) {
    const fct = async function(...args) {
        if (doDebug) {
            console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        }
        await func.apply(null, args);
        if (doDebug) {
            console.log("       ! " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        }
    }
    return fct;
}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("Testing ctt  ", function() {

        let subscription = null;

        const nodeId = "ns=2;s=Static_Scalar_Int32";
        let monitoredItem1;
        let subscription_raw_notification_event;
        let spy_publish;

        async function create_subscription_and_monitor_item(session) {


            subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription_raw_notification_event = sinon.spy();

            subscription.once("terminated", function() {
            });

            await new Promise((resolve) => {
                subscription.once("started", function() {

                    // monitor 1
                    monitoredItem1 = opcua.ClientMonitoredItem.create(subscription,
                        { nodeId: nodeId, attributeId: opcua.AttributeIds.Value },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 100
                        });

                    monitoredItem1.once("changed", (dataValue) => {
                        console.log("Receive changed");
                        subscription.on("raw_notification", subscription_raw_notification_event);
                        spy_publish = sinon.spy(session, "publish");
                        resolve();
                    });
                });
            });

        }

        async function prevent_publish_request_acknowledgement(session) {

            session._publishEngine.acknowledge_notification = function(subscriptionId, sequenceNumber) {
                //xx this.subscriptionAcknowledgements.push({
                //xx     subscriptionId: subscriptionId,
                //xx     sequenceNumber: sequenceNumber
                //xx });
            };

        }

        let _the_value = 10001;

        async function write_value(session) {

            _the_value += 1;

            const nodesToWrite = [
                {
                    nodeId: nodeId,
                    attributeId: opcua.AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: opcua.DataType.Int32, value: _the_value }
                    }
                }
            ];
            const statusCode = await session.write(nodesToWrite);
        }

        async function write_value_and_wait_for_change(session) {
            await new Promise((resolve, reject) => {

                const timeoutId = setTimeout(() => {
                    console.log("monitoredItem1 changed notification not recevied in time !");
                    reject(new Error("monitoredItem1 changed notification not recevied in time !"));
                }, 2000);
                monitoredItem1.once("changed", (dataValue) => {
                    clearTimeout(timeoutId);
                    //xx console.log(chalk.cyan("write_value_and_wait_for_change ! Changed !!!!"),dataValue.toString());
                    dataValue.value.value.should.eql(_the_value);
                    resolve();
                });
                write_value(session);
            })
        }

        it("verifying that RepublishRequest service is working as expected", async function() {

            const client = OPCUAClient.create({

            });
            client.on("backoff", () => { console.log("keep trying to connect to ", endpointUrl); });

            const endpointUrl = test.endpointUrl;

            const expected_values = [];
            let sequenceNumbers = [];

            async function verify_republish(session, index) {
                // index  => used to identify sequenceNumbers to retransmit
                const request = new opcua.RepublishRequest({
                    subscriptionId: subscription.subscriptionId,
                    retransmitSequenceNumber: sequenceNumbers[index]
                });

                const response = await session.republish(request);
                //xx console.log(" xx = ",index,request.toString());
                //xx console.log(" xx = ",index,response.toString());
                response.notificationMessage.notificationData[0].monitoredItems[0].should.eql(expected_values[index]);
            }

            await perform_operation_on_subscription_async(client, endpointUrl, async (session) => {
                await f(create_subscription_and_monitor_item)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(prevent_publish_request_acknowledgement)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);

                subscription_raw_notification_event.callCount.should.eql(4);

                const seqNumber1 = subscription_raw_notification_event.getCall(0).args[0].sequenceNumber;
                subscription_raw_notification_event.getCall(0).args[0].sequenceNumber.should.eql(seqNumber1 + 0);
                subscription_raw_notification_event.getCall(1).args[0].sequenceNumber.should.eql(seqNumber1 + 1);
                subscription_raw_notification_event.getCall(2).args[0].sequenceNumber.should.eql(seqNumber1 + 2);
                subscription_raw_notification_event.getCall(3).args[0].sequenceNumber.should.eql(seqNumber1 + 3);

                //xx console.log(subscription_raw_notification_event.getCall(0).args[0].notificationData[0].monitoredItems[0].toString());
                //xx console.log(subscription_raw_notification_event.getCall(1).args[0].toString());
                //xx console.log(subscription_raw_notification_event.getCall(2).args[0].toString());
                //xx console.log(subscription_raw_notification_event.getCall(3).args[0].toString());

                expected_values.push(subscription_raw_notification_event.getCall(1).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event.getCall(2).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event.getCall(3).args[0].notificationData[0].monitoredItems[0]);

                spy_publish.callCount.should.eql(4);
                //xx console.log(spy_publish.getCall(7).args[0].toString());

                sequenceNumbers = [seqNumber1 + 1, seqNumber1 + 2, seqNumber1 + 3];
                //xx console.log(expected_values, sequenceNumbers);

                await f(verify_republish)(session, 0);
                await f(verify_republish)(session, 1);
                await f(verify_republish)(session, 2);

            });
        });
    });
};
