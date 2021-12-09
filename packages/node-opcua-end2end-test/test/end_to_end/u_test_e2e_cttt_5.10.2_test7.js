"use strict";
/* based on  Test 5.10.2 Test case 7
   Description: Modifies a subscription setting RequestedPublishingInterval=LARGENUMBER;
   Server should revise the value to a value it supports. */


const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("Testing ctt  - Test 5.10.2 Test case 7  - SubscriptionBasic - 029.js", function() {


        function performTestWithValue(maxValue, done) {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;
            perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_done) {

                const request = {
                    subscriptionId: subscription.subscriptionId,
                    requestedPublishingInterval: maxValue
                };
                session.modifySubscription(request, function(err, response) {
                    (typeof response.revisedPublishingInterval === "number").should.be.eql(true);
                    response.revisedPublishingInterval.should.not.eql(maxValue);
                    //xx console.log("   requestedPublishingInterval = ",maxValue);
                    //xx console.log("     revisedPublishingInterval = ",response.revisedPublishingInterval);
                    inner_done();
                });
            }, done);

        }
        it("1. Server should revise PublishingInterval the value to a value it support when RequestedPublishingInterval is NaN ", function(done) {
            Number.isNaN(NaN).should.eql(true);
            performTestWithValue(NaN, done);
        });
        it("2. Server should revise PublishingInterval the value to a value it support when RequestedPublishingInterval is Infinity ", function(done) {
            const MAX = 1 / 0.0; // infinity
            performTestWithValue(1 / 0.0, done);
        });
        it("3. Server should revise PublishingInterval the value to a value it support when RequestedPublishingInterval is MaxFloat ", function(done) {
            const MAX = 9007199254740991;
            // should be also Number.MAX_SAFE_INTEGER = Math.pow(2,53) -1
            performTestWithValue(MAX, done);
        });
    });
};