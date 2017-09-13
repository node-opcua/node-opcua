
var ServerSecureChannelLayer = require("node-opcua-secure-channel/src/server/server_secure_channel_layer").ServerSecureChannelLayer;
var should = require("should");
var debugLog = require("node-opcua-debug").make_debugLog(__filename);
var DirectTransport = require("node-opcua-transport/test_helpers/fake_socket").DirectTransport;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ServerSecureChannelLayer ", function () {

    it("KK1 should create a ServerSecureChannelLayer", function () {

        var server_secure_channel = new ServerSecureChannelLayer();
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout.should.be.greaterThan(100);

    });

    it("KK2 should end with a timeout if no message is received from client", function (done) {

        var node = new DirectTransport();
        var server_secure_channel = new ServerSecureChannelLayer({});
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout = 50;
        server_secure_channel.init(node.server, function (err) {

            err.message.should.match(/Timeout/);
            done();
        });

        server_secure_channel.on("abort", function () {

        });
    });

    it("KK3 should end with a timeout if HEL/ACK is OK but no further message is received from client", function (done) {

        var node = new DirectTransport();

        var server_has_emitted_the_abort_message = false;

        var server_secure_channel = new ServerSecureChannelLayer();
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout = 50;

        server_secure_channel.init(node.server, function (err) {

            err.message.should.match(/Timeout waiting for OpenChannelRequest/);
            server_has_emitted_the_abort_message.should.eql(true);
            done();

        });

        server_secure_channel.on("abort", function () {
            server_has_emitted_the_abort_message = true;
        });

        // now
        var fake_HelloMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

    });

    it("KK4 should return an error and shutdown if first message is not OpenSecureChannelRequest ", function (done) {

        var node = new DirectTransport();

        var server_has_emitted_the_abort_message = false;
        var server_secure_channel = new ServerSecureChannelLayer();
        server_secure_channel.setSecurity("NONE", "None");

        server_secure_channel.timeout = 50;
        server_secure_channel.init(node.server, function (err) {
            err.message.should.match(/Expecting OpenSecureChannelRequest/);
            server_has_emitted_the_abort_message.should.equal(true);
            done();
        });

        server_secure_channel.on("abort", function () {
            server_has_emitted_the_abort_message = true;
        });
        var fake_HelloMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        var fake_NotAOpenSecureChannelMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_3; // GEP
        node.client.write(fake_NotAOpenSecureChannelMessage);
    });

    it("KK5 should handle a OpenSecureChannelRequest and pass no err in the init callback ", function (done) {

        var node = new DirectTransport();

        var server_secure_channel = new ServerSecureChannelLayer({});
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout = 50;
        server_secure_channel.init(node.server, function (err) {
            should(err).eql(null);

            server_secure_channel.close(done);
        });

        var fake_HelloMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        var fake_OpenSecureChannelRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_2; // OPN
        node.client.write(fake_OpenSecureChannelRequest);

    });

    it("KK6 should handle a OpenSecureChannelRequest start emitting subsequent messages ", function (done) {

        var node = new DirectTransport();

        var server_secure_channel = new ServerSecureChannelLayer();
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout = 50;
        server_secure_channel.init(node.server, function (err) {
            should(err).eql(null);
        });
        server_secure_channel.on("message", function (message) {
            message.request._schema.name.should.equal("GetEndpointsRequest");
            setImmediate(function() {
                server_secure_channel.close(done);
            });
        });

        var fake_HelloMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        var fake_OpenSecureChannelRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_2; // OPN
        node.client.write(fake_OpenSecureChannelRequest);

        var fake_GetEndpointsRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_3; // GetEndPoints
        node.client.write(fake_GetEndpointsRequest);

    });

    it("KK7 should handle a CloseSecureChannelRequest directly and emit a abort event", function (done) {

        var node = new DirectTransport();

        var server_secure_channel = new ServerSecureChannelLayer();
        server_secure_channel.setSecurity("NONE", "None");
        server_secure_channel.timeout = 50;
        server_secure_channel.init(node.server, function (err) {
            should(err).eql(null);
        });

        var nb_on_message_calls = 0;
        server_secure_channel.on("message", function (message) {

            message.request._schema.name.should.not.equal("CloseSecureChannelRequest");
            nb_on_message_calls.should.equal(0);
            nb_on_message_calls += 1;

            message.request._schema.name.should.equal("GetEndpointsRequest");
        });

        server_secure_channel.on("abort", function () {
            done();
        });

        var fake_HelloMessage = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        var fake_OpenSecureChannelRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_2; // OPN
        node.client.write(fake_OpenSecureChannelRequest);

        var fake_GetEndpointsRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_3; // GEP
        node.client.write(fake_GetEndpointsRequest);

        var fake_CloseSecureChannelRequest = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_cs_4; // CLO
        node.client.write(fake_CloseSecureChannelRequest);

    });


});
