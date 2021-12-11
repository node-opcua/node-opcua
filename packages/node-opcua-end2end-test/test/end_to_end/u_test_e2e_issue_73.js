"use strict";

const should = require("should");
const thenify = require("thenify");

const { OPCUAClient, ClientSession, MessageSecurityMode, SecurityPolicy, ServerSecureChannelLayer } = require("node-opcua");
const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const doDebug = false;
// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {
    describe("Testing bug #73 -  Server resets sequence number after secure channel renewal ", function () {
        this.timeout(Math.max(200000, this.timeout()));

        let endpointUrl;
        let oldg_MinimumSecureTokenLifetime;
        beforeEach(() => {
            oldg_MinimumSecureTokenLifetime = ServerSecureChannelLayer.g_MinimumSecureTokenLifetime;
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = 250;

            endpointUrl = test.endpointUrl;
        });
        afterEach(() => {
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = oldg_MinimumSecureTokenLifetime;
        });

        it("should not reset sequence number after secure channel renewal ", async () => {
            const options = {
                securityMode,
                securityPolicy,
                serverCertificate: null,
                defaultSecureTokenLifetime: 200 // << Use a very small secure token lifetime to speed up test !
            };
            const client = OPCUAClient.create(options);

            const sequenceNumbers = [];
            const messages = [];
            const old_client_connect = client.connect;

            function new_client_connect(endpointUrl, callback) {
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                const self = this;
                old_client_connect.call(self, endpointUrl, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    self._secureChannel.messageBuilder.on("message", function (msg) {
                        try {
                            messages.push(msg.constructor.name);

                            if (self._secureChannel) {
                                sequenceNumbers.push(self._secureChannel.messageBuilder.sequenceHeader.sequenceNumber);
                                // console.log(" msg = ",msg.constructor.name,self._secureChannel.messageBuilder.sequenceHeader.sequenceNumber);
                            }
                        } catch (err) {
                            console.log("err", err);
                        }
                    });
                    // call default implementation
                    callback.apply(null, arguments);
                });
            }

            client.connect = thenify.withCallback(new_client_connect);

            await client.withSessionAsync(endpointUrl, async (session) => {
                let counter = 0;
                await new Promise((resolve) => {
                    client.on("security_token_renewed",()=> {
                        counter++;
                        if (resolve && counter >= 3) {
                            resolve();
                            resolve = null;
                        }
                    })
                });
            });

            // verify that Token has been renewed ...
            // ( i.e we have received multiple OpenSecureChannel
            messages
                .filter((a) => a === "OpenSecureChannelResponse")
                .length.should.be.greaterThan(2, "number of security token renewal");

            // sequence number should be increasing monotonically
            if (doDebug) {
                console.log(sequenceNumbers);
            }

            for (let i = 1; i < sequenceNumbers.length; i++) {
                sequenceNumbers[i].should.be.greaterThan(sequenceNumbers[i - 1]);
            }
        });
    });
};
