"use strict";

const { assert } = require("node-opcua-assert");
const should = require("should");
const async = require("async");

const {
    OPCUAClient,
    ClientSession,
    MessageSecurityMode,
    SecurityPolicy,
} = require("node-opcua");
const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;


const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const doDebug = false;
// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function(test) {

    describe("Testing bug #73 -  Server resets sequence number after secure channel renewal ", function() {

        const options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: null,
            defaultSecureTokenLifetime: 100   // << Use a very small secure token lifetime to speed up test !
        };

        this.timeout(Math.max(200000, this.timeout()));

        let client, endpointUrl;

        beforeEach(function(done) {
            client = OPCUAClient.create(options);
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function(done) {
            client.disconnect(done);
            client = null;
        });

        it("should not reset sequence number after secure channel renewal ", function(done) {


            const old_client_connect = client.connect;

            const sequenceNumbers = [];
            const messages = [];

            function new_client_connect(endpointUrl, callback) {
                const self = this;
                old_client_connect.call(this, endpointUrl, function(err) {


                    self._secureChannel.messageBuilder.on("message", function(msg) {

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

            perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

                setTimeout(function() {

                    // verify that Token has been renewed ...
                    // ( i.e we have received multiple OpenSecureChannel
                    messages.filter((a) => a === "OpenSecureChannelResponse")
                        .length.should.be.greaterThan(2, "number of security token renewal");

                    // sequence number should be increasing monotonically
                    if (doDebug) {
                        console.log(sequenceNumbers);
                    }

                    for (let i = 1; i < sequenceNumbers.length; i++) {
                        sequenceNumbers[i].should.be.greaterThan(sequenceNumbers[i - 1]);
                    }
                    inner_done();
                }, 3000);

            }, done);

        });
    });
};
