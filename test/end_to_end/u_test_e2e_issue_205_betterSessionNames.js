/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


module.exports = function (test) {


    describe("Testing enhancement request  #205 -  set client name to get meaningful session name",function() {

        it("Default client sessionName ",function(done) {

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            async.series([
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                        session.name.should.eql("Session1");
                        inner_done();
                    },callback);
                },
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                        session.name.should.eql("Session2");
                        inner_done();
                    },callback);
                }
            ],done)

        });

        it("should be possible to set the clientName to get more expressive  sessionName ",function(done) {

            var client = new OPCUAClient({ clientName: "ABCDEF-"});

            var endpointUrl = test.endpointUrl;
            async.series([
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                        session.name.should.eql("ABCDEF-1");
                        inner_done();
                    },callback);
                },
                function(callback) {
                    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                        session.name.should.eql("ABCDEF-2");
                        inner_done();
                    },callback);
                }
            ],done)

        });
    });

};