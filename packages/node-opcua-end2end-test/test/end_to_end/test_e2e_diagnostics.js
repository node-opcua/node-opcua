"use strict";
const opcua = require("node-opcua");
const should = require("should");

const OPCUAClient = opcua.OPCUAClient;
const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const { redirectToFile } = require("node-opcua-debug/nodeJS");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Testing Server and Client diagnostic facilities", function() {

    let server, client, temperatureVariableId, endpointUrl;

    let port = 2001;
    before(function(done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({ port: port }, function(err) {

            if (err) return done(err);

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done) {
        client = OPCUAClient.create({});
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(done);
    });

    function extract_server_channel() {
        const cp = server.endpoints[0];
        const ckey = Object.keys(cp._channels);
        const channel = cp._channels[ckey[0]];
        return channel;
    }

    it("MM01- Server should keep track of transaction statistics", function(done) {

        //xx redirectToFile("transaction_statistics.log", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {


            const server_channel = extract_server_channel();

            let transaction_done_counter = 0;

            let transactionCounter = client.transactionsPerformed;
            server_channel.on("transaction_done", function() {
                transaction_done_counter++;

                console.log(" Server bytes read : ", server_channel.bytesRead, " bytes written : ", server_channel.bytesWritten);
                console.log(" Client bytes read : ", client.bytesRead, " bytes written : ", client.bytesWritten);
                console.log(" transaction count : ", client.transactionsPerformed);

                client.bytesWritten.should.eql(server_channel.bytesRead);
                client.transactionsPerformed.should.eql(transactionCounter + 1);
                transactionCounter += 1;

            });

            session.browse("RootFolder", function(err, browseResult) {
                should.not.exist(err);
                should.exist(browseResult);
                inner_done();
            });

        }, done);
        //xx }, done);
    });
});
