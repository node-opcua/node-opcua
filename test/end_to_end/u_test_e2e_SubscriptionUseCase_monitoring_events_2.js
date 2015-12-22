/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var securityMode = opcua.MessageSecurityMode.NONE;
var securityPolicy = opcua.SecurityPolicy.None;

module.exports = function (test) {
    xdescribe("OPCUA Event - test2 ", function () {
        var client, endpointUrl;

        var options ={};
        beforeEach(function (done) {
            client = new OPCUAClient(options);
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("should monitored event from server ",function(done) {

            done();
        });

    });
};
