"use strict";
var opcua = require("node-opcua");
var should = require("should");

var OPCUAClient = opcua.OPCUAClient;
var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var redirectToFile = require("node-opcua-debug").redirectToFile;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Testing Server and Client diagnostic facilities", function () {

    var server, client, temperatureVariableId, endpointUrl;

    var port = 2001;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    function extract_server_channel() {
        var cp = server.endpoints[0];
        var ckey = Object.keys(cp._channels);
        var channel = cp._channels[ckey[0]];
        return channel;
    }

    it("Server should keep track of transaction statistics", function (done) {

        redirectToFile("transaction_statistics.log", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {


                var server_channel = extract_server_channel();

                var transaction_done_counter = 0;
                server_channel.on("transaction_done", function () {
                    transaction_done_counter++;
                    server_channel._dump_transaction_statistics();

                    console.log(" Server bytes read : ", server_channel.bytesRead, " bytes written : ", server_channel.bytesWritten);
                    console.log(" Client bytes read : ", client.bytesRead, " bytes written : ", client.bytesWritten);
                    console.log(" transaction count : ", client.transactionsPerformed);
                    if (transaction_done_counter === 1) {
                        done();
                    }
                });

                session.browse("RootFolder", function (err, browseResults, diagnosticInfos) {
                    should(err).eql(null);
                });

            }, done);
        }, done);
    });
});
