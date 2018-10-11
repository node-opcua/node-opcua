"use strict";

const should = require("should");
const async = require("async");

const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const coerceNodeId = opcua.coerceNodeId;

const perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Testing issue#313 ", function () {

        // from https://github.com/mikakaraila/node-red-contrib-opcua/issues/30:
        //
        // Hello, I am experiencing a crash of Node-Red when subscribing to a miss-typed/incorrect NodeID.
        // I'm injecting the namespace and NodeID using the injection node. If I use the correct values, everything
        // is working as expected.
        // Let's assume, the correct NodeID would be "TestVerzeichnis.TestKnoten". When we mess it up to
        // "TestVerzeichnis.TestKnotn" we are receiving the following error:
        // "subscription.monitorItem:Error: BadNodeIdUnknown (0x80340000)"
        // So far, so good - when I inject again, Node-Red would crash with the following error

        it("Should not crash when monitoring the same invalid nodeId for the second time ", function (done) {

            const nodeId = coerceNodeId("ns=4;s=TestVerzeichnis.TestKnotn"); // Server Object
            const client = new OPCUAClient();
            const endpointUrl = test.endpointUrl;

            function add_monitored_item(subscription, callback) {
                const monitoredItem = subscription.monitor({
                      nodeId: nodeId,
                      attributeId: opcua.AttributeIds.Value
                  },
                  {samplingInterval: 50, discardOldest: true, queueSize: 1},
                  opcua.TimestampsToReturn.Both,
                  function (err) {
                      should.not.exist(err);
                      console.log("err", err ? err.message :"<no error>");
                      setTimeout(callback,1000);
                  });
                monitoredItem.on("changed",function(dataValue){
                    // should not get here !
                    console.log("value = ",dataValue.toString());
                });
                monitoredItem.on("err",function(errMessage){
                    console.log("err = ",errMessage);
                });
            }

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {
                async.series([
                    add_monitored_item.bind(null, subscription),
                    add_monitored_item.bind(null, subscription)
                ], inner_done);
            }, done);
        });
    });
};
