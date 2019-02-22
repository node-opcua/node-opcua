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

const assert = require("node-opcua-assert").assert;
const async = require("async");
const should = require("should");
const sinon = require("sinon");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
const perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Testing ctt  ", function () {


        const ClientSubscription = opcua.ClientSubscription;
        let subscription = null;

        const nodeId = "ns=2;s=Scalar_Static_Int32";
        let monitoredItem1;
        let subscription_raw_notification_event;
        let spy_publish;

        function create_subscription_and_monitor_item(the_session, callback) {

            subscription = ClientSubscription.create(the_session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription_raw_notification_event = sinon.spy();

            subscription.once("terminated", function () {
            });
            subscription.once("started", function () {

                // monitor 1
                monitoredItem1 = opcua.ClientMonitoredItem.create(subscription,
                  {nodeId: nodeId, attributeId: opcua.AttributeIds.Value},
                  {
                      samplingInterval: 100,
                      discardOldest: true,
                      queueSize: 100
                  });

                monitoredItem1.once("changed", function (dataValue) {
                    subscription.on("raw_notification", subscription_raw_notification_event);
                    spy_publish = sinon.spy(the_session, "publish");
                    callback();
                });
            });

        }

        function prevent_publish_request_acknowledgement(session, callback) {

            session._publishEngine.acknowledge_notification = function (subscriptionId, sequenceNumber) {
                //xx this.subscriptionAcknowledgements.push({
                //xx     subscriptionId: subscriptionId,
                //xx     sequenceNumber: sequenceNumber
                //xx });
            };
            callback();

        }

        let _the_value = 10001;

        function write_value(session, callback) {

            _the_value += 1;

            const nodesToWrite = [
                {
                    nodeId: nodeId,
                    attributeId: opcua.AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: opcua.DataType.Int32, value: _the_value}
                    }
                }
            ];
            session.write(nodesToWrite, function (err) {
                callback(err);
            });
        }

        function write_value_and_wait_for_change(session, callback) {

            monitoredItem1.once("changed", function (dataValue) {
                //xx console.log(chalk.cyan("write_value_and_wait_for_change ! Changed !!!!"),dataValue.toString());
                dataValue.value.value.should.eql(_the_value);
                callback();
            });
            write_value(session, function (err) {
            });
        }

        it("verifying that RepublishRequest service is working as expected", function (done) {

            const client = OPCUAClient.create({

            });
            const endpointUrl = test.endpointUrl;

            const expected_values = [];
            let sequenceNumbers = [];

            function verify_republish(session,index, callback) {
                // index  => used to identify sequenceNumbers to retransmit
                const request = new opcua.RepublishRequest({
                    subscriptionId: subscription.subscriptionId,
                    retransmitSequenceNumber: sequenceNumbers[index]
                });

                session.republish(request, function (err, response) {
                    //xx console.log(" xx = ",index,request.toString());
                    //xx console.log(" xx = ",index,response.toString());
                    should.not.exist(err);
                    response.notificationMessage.notificationData[0].monitoredItems[0].should.eql(expected_values[index]);
                    callback(err);
                });
            }


            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                async.series([
                    //xx write_value.bind(null,session),
                    create_subscription_and_monitor_item.bind(null, session),
                   //Xx function(callback){setTimeout(callback,100);},
                    write_value_and_wait_for_change.bind(null, session),
                    prevent_publish_request_acknowledgement.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),

                    function (callback) {

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
                        callback()
                    },
                    verify_republish.bind(null,session, 0),
                    verify_republish.bind(null,session, 1),
                    verify_republish.bind(null,session, 2)

                ], inner_done);

            }, done);
        });
    });
};
