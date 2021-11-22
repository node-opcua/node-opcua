"use strict";

const should = require("should");

const opcua = require("node-opcua");

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");
const { redirectToFile } = require("node-opcua-debug/nodeJS");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {


    describe("Testing server when client sessionName  is not defined   #355", function() {

        before(function(done) {
            done();
        });
        it("#355 Client MonitoredItem event handler should be protected against exception raised in user code", function(done) {

            const server = test.server;

            if (!server) {
                return done();
            }

            const client = opcua.OPCUAClient.create();

            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {

                redirectToFile("issue_355", function(callback) {

                    const monitoredItem = opcua.ClientMonitoredItem.create(subscription,
                        { nodeId: "ns=1;s=FanSpeed", attributeId: opcua.AttributeIds.Value },
                        {
                            samplingInterval: 10, // sampling twice as fast as variable refresh rate
                            discardOldest: true,
                            queueSize: 10
                        });

                    let count = 0;
                    let timerId;
                    monitoredItem.on("changed", function(dataValue) {

                        count++;
                        if (count >= 5) {
                            clearInterval(timerId);
                            return callback();
                        }
                        // simulate an user error in event handler
                        throw new Error("Exception in user code");

                    });

                    timerId = setInterval(function() {
                        const node = test.server.engine.addressSpace.findNode("ns=1;s=FanSpeed");
                        node.setValueFromSource(new opcua.Variant({
                            value: Math.random(),
                            dataType: opcua.DataType.Double
                        }));
                    }, 100);

                }, callback);


            }, done);

        });

    });

};
