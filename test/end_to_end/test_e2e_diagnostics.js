require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");


var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var coerceNodeId = opcua.coerceNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;


var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var redirectToFile = require("lib/misc/utils").redirectToFile;

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
        assert(ckey.length === 1);
        var channel = cp._channels[ckey[0]];
        //assert(channel instanceof ServerSecureChannelLayer);
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
