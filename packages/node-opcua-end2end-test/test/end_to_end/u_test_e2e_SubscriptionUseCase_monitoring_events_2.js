/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

module.exports = function (test) {
    xdescribe("OPCUA Event - test2 ", function () {
        let client, endpointUrl;

        const options ={};
        beforeEach(function (done) {
            client = OPCUAClient.create(options);
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
