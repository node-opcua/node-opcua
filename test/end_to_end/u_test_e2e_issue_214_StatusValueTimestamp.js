/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;

var debugLog = function() {};

module.exports = function (test) {

    describe("Testing issue  #214 -  DataChangeTrigger.StatusValueTimestamp", function () {

        it("#214 -  DataChangeTrigger.StatusValueTimestamp", function (done) {

            // setup  mechanism to update a Variable value timestamp without changing the value

            var nodeId = "ns=411;s=Scalar_Static_Double";
            var variable = test.server.engine.addressSpace.findNode(nodeId);
            var variant = new opcua.Variant({dataType: opcua.DataType.Double,value: 3.14 });

            var timerId = setInterval(function () {
                var now = new Date();
                var dataValue = new opcua.DataValue({
                    sourceTimestamp: now,
                    sourcePicoseconds: 0,
                    serverTimestamp: now,
                    serverPicoseconds: 0,
                    statusCode: opcua.StatusCodes.Good
                });
                dataValue.value = variant;
                variable._internal_set_dataValue(dataValue, null);
            },100);

            var nbChanges = 0;

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            perform_operation_on_subscription(client, endpointUrl, function (session, the_subscription, inner_done) {

                the_subscription.on("started", function () {
                    debugLog("subscription started for 10 seconds - subscriptionId=", the_subscription.subscriptionId);
                }).on("keepalive", function () {
                    debugLog("keepalive");
                }).on("terminated", function () {
                    debugLog(" subscription terminated");
                });

                setTimeout(function () {
                    clearInterval(timerId);
                    inner_done();
                }, 2000);

                var filter = new opcua.subscription_service.DataChangeFilter({
                    trigger: opcua.subscription_service.DataChangeTrigger.StatusValueTimestamp,
                    deadbandType: opcua.subscription_service.DeadbandType.Absolute,
                    deadbandValue: 1.0
                });

                var itemToMonitor = {
                    nodeId: nodeId,
                    attributeId: opcua.AttributeIds.Value
                };
                var options = {
                    samplingInterval: 100,
                    discardOldest: false,
                    queueSize: 10000,
                    filter: filter
                };
                // install monitored item
                var monitoredItem = the_subscription.monitor(itemToMonitor,
                  options,
                    opcua.read_service.TimestampsToReturn.Both
                    , function (err) {
                        debugLog(" ERR =", err);
                    });

                monitoredItem.on("initialized", function () {
                    debugLog("monitoredItem initialized");
                });
                monitoredItem.on("changed", function (dataValue) {
                    debugLog("  value = ", dataValue.value.toString());
                    nbChanges +=1;
                });
                monitoredItem.on("err", function (err_message) {
                    debugLog(monitoredItem.itemToMonitor.nodeId.toString(), " ERROR".red, err_message);
                });
            }, function(err){

                nbChanges.should.be.above(5);
                done(err);
            });

        });

    });

};