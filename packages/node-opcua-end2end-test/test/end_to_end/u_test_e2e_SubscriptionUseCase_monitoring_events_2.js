/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;

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
