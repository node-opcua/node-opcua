/* global describe, it, require*/
"use strict";
var should = require("should");
var opcua = require("node-opcua");
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {
    describe("Testing getEndpointRequest", function () {
        before(function (done) {
            var server = test.server;
            done();
        });
        it("#417 getEndpointRequest shall return valid endpointUrl", function (done) {
            var server = test.server;
            if (!server) {
                return done();
            }
            var client = new opcua.OPCUAClient({});
            perform_operation_on_client_session(client, test.endpointUrl, function (session, callback) {
                client.getEndpointsRequest({},function(err,serverEndpoints){
                    //xx console.log(serverEndpoints[0].toString());
                    serverEndpoints[0].endpointUrl.should.match(/opc.tcp:/);
                    callback(err);
                })
            }, done);
        });
    });
};
