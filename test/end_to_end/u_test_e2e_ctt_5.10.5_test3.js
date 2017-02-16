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
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Testing ctt  ", function () {


        var ClientSubscription = opcua.ClientSubscription;
        var subscription = null;

        var nodeId = "ns=411;s=Scalar_Static_Int32";
        var monitoredItem1;
        var subscription_raw_notification_event;
        var spy_publish;

        function create_subscription_and_monitor_item(the_session, callback) {

            assert(the_session instanceof opcua.ClientSession);

            subscription = new ClientSubscription(the_session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription_raw_notification_event = sinon.spy();
            subscription.on("raw_notification", subscription_raw_notification_event);
            spy_publish = sinon.spy(the_session, "publish");

            subscription.once("terminated", function () {
            });
            subscription.once("started", function () {
                callback();
            });

            // monitor 1
            monitoredItem1 = subscription.monitor(
              {nodeId: nodeId, attributeId: opcua.AttributeIds.Value},
              {
                  samplingInterval: 100,
                  discardOldest: true,
                  queueSize: 100
              });

            monitoredItem1.on("changed", function (dataValue) {
                //xx console.log("DataValue1 = ", dataValue.value.toString());
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

        var _the_value = 10001;

        function write_value(session, callback) {

            _the_value += 1;

            var nodesToWrite = [
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
                dataValue.value.value.should.eql(_the_value);
                callback();
            });
            write_value(session, function (err) {
            });
        }

        it("HGHGH should ....", function (done) {

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            var expected_values = [];
            var sequenceNumbers = [];

            function verify_republish(session,index, callback) {

                var request = new opcua.subscription_service.RepublishRequest({
                    subscriptionId: subscription.subscriptionId,
                    retransmitSequenceNumber: sequenceNumbers[index]
                });

                session.republish(request, function (err, response) {
                    //xx console.log(" xx = ",index,request.toString());
                    //xx console.log(" xx = ",index,response.toString());
                    response.notificationMessage.notificationData[0].monitoredItems[0].should.eql(expected_values[index]);
                    callback(err);
                });
            }
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


                async.series([
                    create_subscription_and_monitor_item.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),
                    prevent_publish_request_acknowledgement.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),
                    write_value_and_wait_for_change.bind(null, session),

                    function (callback) {

                        subscription_raw_notification_event.callCount.should.eql(4);

                        var seqNumber1 = subscription_raw_notification_event.getCall(0).args[0].sequenceNumber;
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

                        spy_publish.callCount.should.eql(8);
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
