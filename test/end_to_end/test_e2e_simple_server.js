require("requirish")._(module);

var should = require("should");
var async = require("async");

var opcua = require("index.js");
var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

var get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;

var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


describe("Testing a simple server from Server side", function () {

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    it("should have at least one endpoint", function () {

        var server = new OPCUAServer({port: 6789, nodeset_filename: empty_nodeset_filename});

        server.endpoints.length.should.be.greaterThan(0);

        var endPoint = server.endpoints[0];

        var e = opcua.parseEndpointUrl(endPoint.endpointDescriptions()[0].endpointUrl);

        var expected_hostname = get_fully_qualified_domain_name();
        e.hostname.should.be.match(new RegExp(expected_hostname));

        e.port.should.eql(6789);

    });
    it("OPCUAServer#getChannels", function (done) {


        var server = new OPCUAServer({port: 1239, nodeset_filename: empty_nodeset_filename});
        server.getChannels().length.should.equal(0);

        server.start(function () {

            server.getChannels().length.should.equal(0);

            // now make a simple connection
            var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            var options = {};
            var client = new OPCUAClient(options);
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                server.getChannels().length.should.equal(1);
                //xx console.log("xxxxx nb Channels ",server.getChannels().length);
                inner_done();
            }, function () {
                server.shutdown(function () {
                    OPCUAServer.registry.count().should.eql(0);
                    done();
                });
            });
        });

    });


    it("should start and shutdown", function (done) {

        var server = new OPCUAServer({port: 6789, nodeset_filename: empty_nodeset_filename});

        server.start(function () {
            process.nextTick(function () {
                server.shutdown(function () {
                    done();
                });
            });
        });
    });

});


