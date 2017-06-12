/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var redirectToFile = require("lib/misc/utils").redirectToFile;

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
                            callback();
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


            },done);

        });

    });

};
