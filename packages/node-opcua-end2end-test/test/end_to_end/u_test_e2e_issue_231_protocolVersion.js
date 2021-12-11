"use strict";
const async = require("async");
const should = require("should");

const { OPCUAClient } = require("node-opcua");

module.exports = function (test) {
    describe("Testing issue  #231 -  Server should accept client with protocolVersion greater than the protocolVersion it supports", function () {
        it("#231-A ", function (done) {
            const client1 = OPCUAClient.create();

            client1.protocolVersion.should.eql(0);
            client1.protocolVersion = 0x1000;

            const endpointUrl = test.endpointUrl;

            async.series(
                [
                    function (callback) {
                        client1.connect(endpointUrl, callback);
                    },

                    function (callback) {
                        client1.disconnect(function () {
                            callback();
                        });
                    }
                ],
                done
            );
        });
        it("#231-B BadProtocolVersionUnsupported", function (done) {
            const client1 = OPCUAClient.create();

            client1.protocolVersion.should.eql(0);

            // special version number that causes our server to simulate BadProtocolVersionUnsupported
            client1.protocolVersion = 0xdeadbeef;

            const endpointUrl = test.endpointUrl;

            async.series(
                [
                    function (callback) {
                        client1.connect(endpointUrl, function (err) {
                            err.message.should.match(/BadProtocolVersionUnsupported/);
                            callback();
                        });
                    },

                    function (callback) {
                        client1.disconnect(function () {
                            callback();
                        });
                    }
                ],
                done
            );
        });
    });
};
