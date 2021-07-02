const should = require("should");
const { assert } = require("node-opcua-assert");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const packTcpMessage = require("node-opcua-transport").packTcpMessage;

const ClientSecureChannelLayer = require("..").ClientSecureChannelLayer;
const GetEndpointsRequest = require("node-opcua-service-endpoints").GetEndpointsRequest;

const {
    MockServerTransport,
    fakeAcknowledgeMessage
} = require("../dist/test_helpers");

const { openSecureChannelResponse1 } = require("node-opcua-transport/dist/test-fixtures");
assert(openSecureChannelResponse1);

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ClientSecureChannelLayer ", function() {

    this.timeout(100000);

    it("should create and close a ClientSecureChannelLayer", function(done) {

        // here is a mock of the answer provided by the server
        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            function() {
                return openSecureChannelResponse1 // OpenChannelResponse
            },
            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            //Xx packTcpMessage("CLO", fakeAcknowledgeMessage),
            function() {
                this._mockTransport.server.end();
            },

            function() {
                done(new Error("no more packet to mock"));
            }
        ]);

        mock.once("done", done);


        const clientSecureChannel = new ClientSecureChannelLayer({});

        clientSecureChannel.create("fake://localhost:2033/SomeAddress", function(err) {
            if (err) {
                return done(err);
            }
            clientSecureChannel.close(function(err) {
                done(err);
            });
        });


    });

    it("should use token provided by server in messages", function(done) {


        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            require("node-opcua-transport/dist/test-fixtures").openSecureChannelResponse1,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function() {
                this._mockTransport.server.end();
            }
        ]);

        mock.on("done", done);

        const secureChannel = new ClientSecureChannelLayer({});

        // before connection the securityToken shall not exist
        should(secureChannel.securityToken).equal(null);

        secureChannel.create("fake://localhost:2033/SomeAddress", function(err) {

            if (err) {
                return done(err);
            }

            // after connection client holds the security token provided by the server
            should(secureChannel.securityToken).not.equal(undefined);

            // in our server implementation, token id starts at 1
            secureChannel.securityToken.tokenId.should.equal(1);

            secureChannel.close(function(err) {
                done(err);
            });
        });
    });

    it("should callback with an error if performMessageTransaction is called before connection", function(done) {

        const secureChannel = new ClientSecureChannelLayer({});

        const message = new GetEndpointsRequest({});

        secureChannel.performMessageTransaction(message, function(err /*, response*/) {
            // err.message.should.equal("Client not connected");
            err.message.should.equal("ClientSecureChannelLayer => Socket is closed !");
            done();
        });
    });

    it("should expose the total number of bytes read and written", function(done) {

        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            require("node-opcua-transport/dist/test-fixtures").openSecureChannelResponse1,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function() {
                this._mockTransport.server.end();
            }]);

        mock.on("done", done);

        const secureChannel = new ClientSecureChannelLayer({});

        secureChannel.bytesRead.should.equal(0);
        secureChannel.bytesWritten.should.equal(0);

        secureChannel.create("fake://localhost:2033/SomeAddress", function(err) {
            if (err) {
                return done(err);
            }

            secureChannel.bytesRead.should.be.greaterThan(0);
            secureChannel.bytesWritten.should.be.greaterThan(0);
            secureChannel.transactionsPerformed.should.be.greaterThan(0);

            secureChannel.isTransactionInProgress().should.eql(false);

            const spyOnClose = new require("sinon").spy();
            secureChannel.on("close", spyOnClose);

            secureChannel.close(function(err) {
                spyOnClose.callCount.should.eql(1, "secureChannel#close must be called once");
                done(err);
            });
        });
    });
});
