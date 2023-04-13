"use strict";


const { assert } = require("node-opcua-assert");
const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const doDebug = false;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");


module.exports = function(test) {

    describe("GGH1 Server should check channelId correctness", function() {

        it("server should abruptly stops the connection if client uses wrong channel Id", async () => {

            // testing BadCommunicationError (0x80050000):A low level communication error occurred.

            const client = opcua.OPCUAClient.create({});
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
