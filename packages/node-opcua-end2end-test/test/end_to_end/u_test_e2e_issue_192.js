"use strict";
const should = require("should");
const sinon = require("sinon");
const { OPCUAClient } = require("node-opcua");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing enhancement request #192 ", function () {
        // as a server,
        // I need to receive an event when a new connection is established

        it("#191 Server should receive an 'newChannel' event when a new channel is established and a 'closeChannel' when it close", async () => {
            const server = test.server;

            const spy_new_channel = sinon.spy(function (channel) {
                //xx console.log(chalk.bgYellow("Client connected with address = "),channel.remoteAddress," port = ",channel.remotePort);
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);
            });
            const spy_close_channel = sinon.spy(function (channel) {
                //xx console.log(chalk.bgCyan("Client disconnected with address = "),channel.remoteAddress," port = ",channel.remotePort);
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);
            });

            server.on("newChannel", spy_new_channel);
            server.on("closeChannel", spy_close_channel);

            if (!server) {
                return;
            }

            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            await client1.connect(endpointUrl);
            await client1.disconnect();

            server.removeListener("newChannel", spy_new_channel);
            server.removeListener("closeChannel", spy_close_channel);

            spy_new_channel.callCount.should.eql(1);
            spy_close_channel.callCount.should.eql(1);
        });
    });
};
