"use strict";

var should = require("should");
var async = require("async");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;
var coerceNodeId = opcua.coerceNodeId;

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

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

        it("Should not crash when monitoring the same invalid nodeId for the second time ",function(done) {

            var nodeId = coerceNodeId("ns=4;s=TestVerzeichnis.TestKnotn"); // Server Object
            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            function add_monitored_item(subscription,callback) {

                console.log("Hello");
                var monitoredItem = subscription.monitor(
                  {
                      nodeId: nodeId,
                      attributeId: opcua.AttributeIds.Value
                  },
                  {samplingInterval: 50, discardOldest: true, queueSize: 1},
                opcua.read_service.TimestampsToReturn.Both,
                function(err){
                      console.log("err",err.message);
                      callback();
                });

            }
            perform_operation_on_subscription(client, endpointUrl,function(session,subscription,inner_done){

                async.series([
                    add_monitored_item.bind(null,subscription),
                    add_monitored_item.bind(null,subscription)
                ],inner_done);
            },done);
        });
    });
};
