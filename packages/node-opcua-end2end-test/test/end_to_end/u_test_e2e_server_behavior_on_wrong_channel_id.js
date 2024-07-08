"use strict";

const { assert } = require("node-opcua-assert");
const should = require("should");
const opcua = require("node-opcua");
const doDebug = false;

module.exports = function (test) {
    describe("GGH1 Server should check channelId correctness", function () {
        xit("server should abruptly stops the connection if client uses wrong channel Id", async () => {
            const client = opcua.OPCUAClient.create({
                defaultTransactionTimeout: 100000
            });
            const endpointUrl = test.endpointUrl;

            await client.connect(endpointUrl);

            const result1 = await client.getEndpoints({});

            client._secureChannel.channelId.should.be.above(0);

            const oldChannelId = client._secureChannel.channelId;

            // lets alter channelId
            const secureChannel = client._secureChannel;
            secureChannel.channelId = 0;

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

            errorHasBeenCaught.should.eql(true, " server must raise an error if channel is invalid");
        });
    });
};
