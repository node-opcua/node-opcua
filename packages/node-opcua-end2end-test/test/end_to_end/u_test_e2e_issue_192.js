"use strict";

const async = require("async");
const should = require("should");
const sinon = require("sinon");
const { OPCUAClient } = require("node-opcua");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing enhancement request #192 ", function () {
        // as a server,
        // I need to receive an event when a new connection is established

        it("#191 Server should receive an 'newChannel' event when a new channel is established and a 'closeChannel' when it close", function (done) {
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
                return done();
            }

            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            async.series(
                [
                    function (callback) {
                        client1.connect(endpointUrl, callback);
                    },
                    function (callback) {
                        client1.disconnect(function () {
                            //xx console.log(" Client disconnected ", (err ? err.message : "null"));
                            callback();
                        });
                    },
                    function (callback) {
                        server.removeListener("newChannel", spy_new_channel);
                        server.removeListener("closeChannel", spy_close_channel);

                        spy_new_channel.callCount.should.eql(1);
                        spy_close_channel.callCount.should.eql(1);
                        callback();
                    }
                ],
                done
            );
        });
    });
};
