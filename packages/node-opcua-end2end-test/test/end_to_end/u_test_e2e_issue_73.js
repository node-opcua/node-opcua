"use strict";
require("should");
const { OPCUAClient, MessageSecurityMode, SecurityPolicy, ServerSecureChannelLayer } = require("node-opcua");

const doDebug = false;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {
    describe("Testing bug #73 -  Server resets sequence number after secure channel renewal ", function () {
        this.timeout(Math.max(200000, this.timeout()));

        let endpointUrl;
        let old_g_MinimumSecureTokenLifetime;
        beforeEach(() => {
            old_g_MinimumSecureTokenLifetime = ServerSecureChannelLayer.g_MinimumSecureTokenLifetime;
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = 250;

            endpointUrl = test.endpointUrl;
        });
        afterEach(() => {
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = old_g_MinimumSecureTokenLifetime;
        });

        [
            // with a
            {
                securityMode: MessageSecurityMode.None,
                securityPolicy: SecurityPolicy.None
            },
            // with an encrypted channel
            {
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256
            }
        ].forEach(({ securityMode, securityPolicy }, index) =>
            it(`T73-${index} should not reset sequence number after secure channel renewal ${MessageSecurityMode[securityMode]} - ${securityPolicy}`, async () => {
                const options = {
                    securityMode,
                    securityPolicy,
                    serverCertificate: null,
                    defaultSecureTokenLifetime: 200 // << Use a very small secure token lifetime to speed up test !
                };
                const client = OPCUAClient.create(options);

                const sequenceNumbers = [];
                const messages = [];

                client.on("secure_channel_created", (channel) => {
                    channel.on("message", (msg) => {
                        try {
                            messages.push(msg.constructor.name);
                            sequenceNumbers.push(channel._getMessageBuilder().sequenceHeader.sequenceNumber);
                        } catch (err) {
                            console.log("err", err);
                        }
                    });
                });
                await client.withSessionAsync(endpointUrl, async (session) => {
                    let counter = 0;
                    await new Promise((resolve) => {
                        client.on("security_token_renewed", () => {
                            counter++;
                            if (resolve && counter >= 3) {
                                resolve();
                                resolve = null;
                            }
                        });
                    });
                });

                console.log("message", messages);

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
            })
        );
    });
};
