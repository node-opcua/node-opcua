"use strict";
const OPCUAClient = require("..").OPCUAClient;
const ClientSecureChannelLayer =  require("..").ClientSecureChannelLayer;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("OPCUA Client",function() {

    it("it should create a client", function () {

        const client = new OPCUAClient({});

    });
    it("should create a ClientSecureChannerLayer", function () {

        new ClientSecureChannelLayer();
    });

});
