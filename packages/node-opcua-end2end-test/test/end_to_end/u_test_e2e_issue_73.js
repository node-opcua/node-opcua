/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

var assert = require("better-assert");
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var resourceLeakDetector = require("node-opcua-test-helpers/src/resource_leak_detector").resourceLeakDetector;

var securityMode   = opcua.MessageSecurityMode.NONE;
var securityPolicy = opcua.SecurityPolicy.None;

// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

module.exports = function (test) {

    describe("Testing bug #73 -  Server resets sequence number after secure channel renewal ", function () {

        var options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: null,
            defaultSecureTokenLifetime: 100   // << Use a very small secure token lifetime to speed up test !
        };

        this.timeout(Math.max(200000, this._timeout));

        var client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient(options);
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("should not reset sequence number after secure channel renewal ", function (done) {


            var old_client_connect = client.connect;

            var sequenceNumbers = [];
            var messages = [];

            function new_client_connect(endpoint_url, callback) {
                var self = this;
                old_client_connect.call(this, endpoint_url, function (err) {


                    self._secureChannel.messageBuilder.on("message", function (msg) {

                        messages.push(msg.constructor.name);

                        if (self._secureChannel) {
                            sequenceNumbers.push(self._secureChannel.messageBuilder.sequenceHeader.sequenceNumber);
                            // console.log(" msg = ",msg.constructor.name,self._secureChannel.messageBuilder.sequenceHeader.sequenceNumber);
                        }
                    });
                    // call default implementation
                    callback.apply(self, arguments);

                })
            }

            client.connect = new_client_connect;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.should.be.instanceOf(ClientSession);

                setTimeout(function () {

                    // verify that Token has been renewed ...
                    // ( i.e we have received multiple OpenSecureChannel
                    _.filter(messages, function (a) {
                        return a === "OpenSecureChannelResponse"
                    }).length.should.be.greaterThan(2);

                    // sequence number should be increasing monotonically
                    console.log(sequenceNumbers);

                    for (var i = 1; i < sequenceNumbers.length; i++) {
                        sequenceNumbers[i].should.be.greaterThan(sequenceNumbers[i - 1]);
                    }
                    inner_done();
                }, 1000);

            }, done);

        });
    });
};
