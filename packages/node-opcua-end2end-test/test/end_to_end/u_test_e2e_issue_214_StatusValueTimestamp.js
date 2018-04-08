/*global describe, it, require*/

const assert = require("node-opcua-assert");
const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
const perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

const debugLog = function () {
};

module.exports = function (test) {

    describe("NXX1 Testing issue  #214 -  DataChangeTrigger.StatusValueTimestamp", function () {

        it("#214 -  DataChangeTrigger.StatusValueTimestamp", function (done) {

            // setup  mechanism to update a Variable value timestamp without changing the value

            const nodeId = "ns=411;s=Scalar_Static_Double";
            const variable = test.server.engine.addressSpace.findNode(nodeId);
            const variant = new opcua.Variant({dataType: opcua.DataType.Double, value: 3.14});

            const timerId = setInterval(function () {
                const now = new Date();
                const dataValue = new opcua.DataValue({
                    sourceTimestamp: now,
                    sourcePicoseconds: 0,
                    serverTimestamp: now,
                    serverPicoseconds: 0,
                    statusCode: opcua.StatusCodes.Good
                });
                dataValue.value = variant;
                variable._internal_set_dataValue(dataValue, null);
            }, 100);

            let nbChanges = 0;

            const client = new OPCUAClient();
            const endpointUrl = test.endpointUrl;

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

                const filter = new opcua.subscription_service.DataChangeFilter({
                    trigger: opcua.subscription_service.DataChangeTrigger.StatusValueTimestamp,
                    deadbandType: opcua.subscription_service.DeadbandType.Absolute,
                    deadbandValue: 1.0
                });

                const itemToMonitor = {
                    nodeId: nodeId,
                    attributeId: opcua.AttributeIds.Value
                };
                const options = {
                    samplingInterval: 100,
                    discardOldest: false,
                    queueSize: 10000,
                    filter: filter
                };
                // install monitored item
                const monitoredItem = the_subscription.monitor(itemToMonitor,
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
                    nbChanges += 1;
                });
                monitoredItem.on("err", function (err_message) {
                    debugLog(monitoredItem.itemToMonitor.nodeId.toString(), " ERROR".red, err_message);
                });
            }, function (err) {

                nbChanges.should.be.above(5);
                done(err);
            });

        });

    });

};