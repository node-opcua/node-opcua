"use strict";

const { assert } = require("node-opcua-assert");
const should = require("should");
const { ClientSecureChannelLayer, OPCUAClient } = require("node-opcua");
const doDebug = false;

module.exports = function (test) {
    describe("GGH1 Server should check channelId correctness", function () {
        it("server should abruptly stops the connection if client uses wrong channel Id", async () => {
            const client = OPCUAClient.create({
                defaultTransactionTimeout: 100000
            });

            client.on("secure_channel_created", (channel) => {
                channel.on("send_request", function (request, msgType, securityHeader) {
                    console.log(
                        " sending",
                        "channelId=",
                        this.channelId,
                        request.constructor.name,
                        request.toString(),
                        securityHeader.toString()
                    );
                });
            });
            const endpointUrl = test.endpointUrl;

            await client.connect(endpointUrl);

            const result1 = await client.getEndpoints({});

            if ((!client._secureChannel) instanceof ClientSecureChannelLayer) {
                throw new Error("expecting a secure channel");
            }
            if (typeof client._secureChannel.channelId !== "number") {
                throw new Error("expecting a channelId");
            }
            client._secureChannel.channelId.should.be.above(0);

            //
            const oldChannelId = client._secureChannel.channelId;

            // lets alter channelId
            const secureChannel = client._secureChannel;
            secureChannel.channelId = 9999;

            let errorHasBeenCaught = false;
            try {
                const result2 = await client.getEndpoints({});
            } catch (err) {
                console.log("err = ", err.message);
                errorHasBeenCaught = true;
            }

            // lets restore channelId
            secureChannel.channelId = oldChannelId;

            await client.disconnect();

            errorHasBeenCaught.should.eql(true, "server must raise an error if channel is invalid");
        });
    });
};
