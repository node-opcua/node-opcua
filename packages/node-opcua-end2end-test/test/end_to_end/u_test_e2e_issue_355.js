/* global describe, it, require*/
"use strict";

var should = require("should");

var opcua = require("node-opcua");

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var redirectToFile = require("node-opcua-debug").redirectToFile;

module.exports = function (test) {


    describe("Testing server when client sessionName  is not defined   #355", function () {

        before(function(done){
            done();
        });
        it("#355 Client MonitoredItem event handler should be protected against exception raised in user code", function (done) {

            var server = test.server;

            if (!server) { return done(); }

            var client = new opcua.OPCUAClient();



            perform_operation_on_subscription(client,test.endpointUrl,function(session,subscription,callback) {

                redirectToFile("issue_355", function (callback) {

                    var monitoredItem = subscription.monitor(
                      {nodeId: "ns=2;s=FanSpeed", attributeId: opcua.AttributeIds.Value},
                      {
                          samplingInterval: 10, // sampling twice as fast as variable refresh rate
                          discardOldest: true,
                          queueSize: 10
                      });

                    var count = 0;
                    var timerId ;
                    monitoredItem.on("changed",function(dataValue){

                        count++;
                        if (count >= 5) {
                            clearInterval(timerId);
                            return callback();
                        }
                        // simulate an user error in event handler
                        throw new Error("Exception in user code");

                    });

                    timerId  = setInterval(function() {
                        var node = test.server.engine.addressSpace.findNode("ns=2;s=FanSpeed");
                        console.log("Set")
                        node.setValueFromSource( new opcua.Variant({
                            value: Math.random(),
                            dataType: "Float"
                        }));
                    },100);

                }, callback);


            },done);

        });

    });

};
