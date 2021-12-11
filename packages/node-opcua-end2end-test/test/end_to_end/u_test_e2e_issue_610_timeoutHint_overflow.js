"use strict";

const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const ClientSubscription = opcua.ClientSubscription;
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {

    describe("Testing bug #610 - TimeoutHint overflow", function () {

        it("using a  large value for requestedPublishingInterval should not cause node-opcua to crash", function(done) {

            const client = OPCUAClient.create({
                requestedSessionTimeout: 2E9
            });
            const endpointUrl = test.endpointUrl;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                ClientSubscription.ignoreNextWarning = true;

                const subscription = ClientSubscription.create(session, {
                    maxNotificationsPerPublish:   10,
                    requestedLifetimeCount:       10 * 60 * 10,
                    requestedMaxKeepAliveCount:   10,

                    priority: 6,
                    publishingEnabled: true,

                    requestedPublishingInterval:  1E9, // very high !!!!

                });

                subscription.once("started",function() {
                    subscription.terminate(inner_done);
                });

            }, done);
        });
    });
};
