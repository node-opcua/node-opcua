"use strict";


//xx var sinon = require("sinon");
//xx var async = require("async");
var should = require("should");
var opcua = require("node-opcua");
var _ = require("underscore");

var OPCUAClient = opcua.OPCUAClient;
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

// create a function that call the callback with an error if
function create_time_bomb_function(timeout,callback) {

    var time_bomb_func = function(err) {
        if (timeoutId){
            clearTimeout(timeoutId);
            timeoutId=0;
            callback(err);
        }
    };
    var timeoutId = setTimeout(function() {
        timeoutId = 0;
        time_bomb_func(new Error("Function has not been called in the requested interval " + timeout));
    },timeout);

    return time_bomb_func;
}

module.exports = function (test) {

    describe("Testing issue#253 ", function () {

        this.timeout(Math.max(3000, this._timeout));

        console.log(" timeout =",this._timeout);

        // let's reduce the minimumSamplingInterval of ServerStatus to a small value, to speed up the test
        var oldMinimumSamplingInterval = 0;
        before(function() {
            if (test.server) {
                var node = test.server.engine.addressSpace.findNode("i=2256");
                oldMinimumSamplingInterval = node.minimumSamplingInterval;
                node.minimumSamplingInterval = 10;
            }
        });
        after(function() {
            if (test.server) {
                var node = test.server.engine.addressSpace.findNode("i=2256");
                node.minimumSamplingInterval  = oldMinimumSamplingInterval;
            }
        });


        it("a subscription should report monitored item notification for ServerStatus", function (done) {


            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {


                var monitoredItem = subscription.monitor({
                    nodeId: opcua.resolveNodeId("ns=0;i=2256"), // ServerStatus Extension Object
                    attributeId: opcua.AttributeIds.Value
                },{
                    samplingInterval: 100,
                    discardOldest:    true,
                    queueSize: 1
                });

                monitoredItem.on("initialized", function () {
                    //xx console.log(monitoredItem.toString());

                    // the monitored item samplingInterval has been adjusted by the server to be
                    // at least the minimumSamplingInterval for this nodeID
                    monitoredItem.monitoringParameters.samplingInterval.should.equal(100);
                });

                var timeout = 5000;
                var time_bomb_inner_done = create_time_bomb_function(timeout,inner_done);

                // time_bomb_inner_done => will terminate by calling inner_done with an error unless
                // it has been called within the timeout interval.

                var counter = 0;
                monitoredItem.on("changed", function (dataValue) {

                    dataValue.value.value.should.have.ownProperty("buildInfo");
                    dataValue.value.value.should.have.ownProperty("startTime");
                    dataValue.value.value.should.have.ownProperty("shutdownReason");
                    dataValue.value.value.constructor.name.should.eql("ServerStatus");

                    console.log(dataValue.value.value.currentTime.toISOString());
                    //xx console.log("dataValue = ",dataValue.toString());
                    counter +=1;
                    if (counter>3) {
                        // ok, we are now convinced that the monitored item receives notification changes for the
                        // ServerStatus
                        time_bomb_inner_done();
                    }
                });

            }, done);

        });

    });
};




