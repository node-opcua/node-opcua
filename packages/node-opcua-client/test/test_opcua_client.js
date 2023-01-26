"use strict";
const { OPCUAClient,ClientSecureChannelLayer } = require("..");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUA Client", function () {
    it("it should create a client", function () {
        const client = OPCUAClient.create({});
    });
    it("should create a ClientSecureChannelLayer", function () {
        const channel = new ClientSecureChannelLayer({});
        channel.dispose();
    });
});
