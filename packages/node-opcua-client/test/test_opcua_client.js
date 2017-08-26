"use strict";
var OPCUAClient = require("..").OPCUAClient;
var ClientSecureChannelLayer =  require("..").ClientSecureChannelLayer;

var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;

describe("OPCUA Client",function() {

    it("it should create a client", function () {

        var client = new OPCUAClient({});

    });
    it("should create a ClientSecureChannerLayer", function () {

        new ClientSecureChannelLayer();
    });

});
