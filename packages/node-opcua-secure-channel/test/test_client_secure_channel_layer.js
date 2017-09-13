var should = require("should");

var ClientSecureChannelLayer = require("../src/client/client_secure_channel_layer").ClientSecureChannelLayer;


var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var MockTransport = require("./mock/mock_transport").MockTransport;
var fake_AcknowledgeMessage = require("./mock/mock_transport").fake_AcknowledgeMessage;


var packTcpMessage = require("node-opcua-transport/src/tools").packTcpMessage;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ClientSecureChannelLayer ", function () {

    it("should create and close a ClientSecureChannelLayer", function (done) {

        var mock = new MockTransport([

            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fake_AcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_sc_2, // OpenChannelResponse

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
           //Xx packTcpMessage("CLO", fake_AcknowledgeMessage),
            function () {
                this.fake_socket.server.end();
            },

            function () {
                done(new Error("no more packet to mock"));
            }

        ], done);


        var secureChannel = new ClientSecureChannelLayer();

        secureChannel.create("fake://localhost:2033/SomeAddress", function (err) {
            if (err) { return done(err); }
            secureChannel.close(function (err) {
                done(err);
            });
        });
    });

    it("should use token provided by server in messages", function (done) {

        var mock = new MockTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fake_AcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_sc_2,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function () {
                this.fake_socket.server.end();
            }

        ], done);


        var secureChannel = new ClientSecureChannelLayer({});

        // before connection the securityToken shall not exist
        should(secureChannel.securityToken).equal(undefined);

        secureChannel.create("fake://localhost:2033/SomeAddress", function (err) {

            if (err) { return done(err); }

            // after connection client holds the security token provided by the server
            should(secureChannel.securityToken).not.equal(undefined);

            // in our server implementation, token id starts at 1
            secureChannel.securityToken.tokenId.should.equal(1);


            secureChannel.close(function (err) {
                done(err);
            });
        });


    });

    it("should callback with an error if performMessageTransaction is called before connection", function (done) {

        var secureChannel = new ClientSecureChannelLayer({});

        var endpoints_service = require("node-opcua-service-endpoints");
        var GetEndpointsRequest = endpoints_service.GetEndpointsRequest;
        var message = new GetEndpointsRequest();

        secureChannel.performMessageTransaction(message, function (err/*, response*/) {
            // err.message.should.equal("Client not connected");
            err.message.should.equal("ClientSecureChannelLayer => Socket is closed !");
            done();
        });

    });

    it("should expose the total number of bytes read and written", function (done) {

        var mock = new MockTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fake_AcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets").packet_sc_2,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function () {
                this.fake_socket.server.end();
            }

        ], done);

        var secureChannel = new ClientSecureChannelLayer();

        secureChannel.bytesRead.should.equal(0);
        secureChannel.bytesWritten.should.equal(0);

        secureChannel.create("fake://localhost:2033/SomeAddress", function (err) {

            if (err) { return done(err); }

            secureChannel.bytesRead.should.be.greaterThan(0);
            secureChannel.bytesWritten.should.be.greaterThan(0);
            secureChannel.transactionsPerformed.should.be.greaterThan(0);

            secureChannel.isTransactionInProgress().should.eql(false);

            var spyOnClose = new require("sinon").spy();
            secureChannel.on("close",spyOnClose);

            secureChannel.close(function (err) {
                spyOnClose.callCount.should.eql(1,"secureChannel#close must be called once");
                done(err);
            });
        });

    });
});
