/*global describe, it, require*/

const { assert } = require("node-opcua-assert");
const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {


    describe("Testing enhancement request  #205 -  set client name to get meaningful session name", function() {

        it("Default client sessionName ", function(done) {

            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            async.series([
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                        session.name.should.eql("ClientSession1");
                        inner_done();
                    }, callback);
                },
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                        session.name.should.eql("ClientSession2");
                        inner_done();
                    }, callback);
                }
            ], done)

        });

        it("should be possible to set the clientName to get more expressive  sessionName ", function(done) {

            const client = OPCUAClient.create({ clientName: "ABCDEF-" });

            const endpointUrl = test.endpointUrl;
            async.series([
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                        session.name.should.eql("ABCDEF-1");
                        inner_done();
                    }, callback);
                },
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                        session.name.should.eql("ABCDEF-2");
                        inner_done();
                    }, callback);
                }
            ], done)

        });
    });

};