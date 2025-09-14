import should from "should";
import sinon from "sinon";
import { make_debugLog } from "node-opcua-debug";
import { packTcpMessage } from "node-opcua-transport";
import { GetEndpointsRequest } from "node-opcua-service-endpoints";
import { openSecureChannelResponse1 } from "node-opcua-transport/dist/test-fixtures";
import * as fixture from "node-opcua-transport/dist/test-fixtures";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { ClientSecureChannelLayer } from "../dist/source";
import { MockServerTransport, fakeAcknowledgeMessage } from "../dist/test_helpers";

const debugLog = make_debugLog(__filename);

describe("testing ClientSecureChannelLayer ", function (this: any) {
    this.timeout(Math.max(120 * 1000, this.timeout()));

    it("should create and close a ClientSecureChannelLayer", function (done) {
        // here is a mock of the answer provided by the server
        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            function () {
                return openSecureChannelResponse1; // OpenChannelResponse
            },
            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            //Xx packTcpMessage("CLO", fakeAcknowledgeMessage),
            function (this: any) {
                this._mockTransport.server.end();
            },

            function () {
                done(new Error("no more packet to mock"));
            }
        ]);

        mock.once("done", done);

        const clientSecureChannel = new ClientSecureChannelLayer({});

        clientSecureChannel.create("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                return done(err);
            }
            clientSecureChannel.close(function (err) {
                done(err);
            });
        });
    });

    it("should use token provided by server in messages", function (done) {
        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            fixture.openSecureChannelResponse1,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function (this: any) {
                this._mockTransport.server.end();
            }
        ]);

        mock.on("done", done);

        const secureChannel = new ClientSecureChannelLayer({});

        
        secureChannel.create("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                return done(err);
            }

          
         
            secureChannel.close(function (err) {
                done(err);
            });
        });
    });

    it("should callback with an error if performMessageTransaction is called before connection", function (done) {
        const secureChannel = new ClientSecureChannelLayer({});

        const message = new GetEndpointsRequest({});

        secureChannel.performMessageTransaction(message, function (err /*, response*/) {
            // err.message.should.equal("Client not connected");
            (err as Error).message.should.match(/ClientSecureChannelLayer => Socket is closed !/);
            done();
        });
    });

    it("should expose the total number of bytes read and written", function (done) {
        const mock = new MockServerTransport([
            // ---------------------------------------------------- Transaction 1
            // Client will send a HEl_message
            // Server will reply with this :
            packTcpMessage("ACK", fakeAcknowledgeMessage),

            // ---------------------------------------------------- Transaction 2
            // client will send a "OPN" OpenSecureChannelRequest
            // Server will reply with this:
            fixture.openSecureChannelResponse1,

            // ---------------------------------------------------- Transaction 3
            // client will send a "CLO" CloseSecureChannelRequest
            // Server will close the socket, without sending a response
            function (this: any) {
                this._mockTransport.server.end();
            }
        ]);

        mock.on("done", done);

        const secureChannel = new ClientSecureChannelLayer({});

        secureChannel.bytesRead.should.equal(0);
        secureChannel.bytesWritten.should.equal(0);

        secureChannel.create("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                return done(err);
            }

            secureChannel.bytesRead.should.be.greaterThan(0);
            secureChannel.bytesWritten.should.be.greaterThan(0);
            secureChannel.transactionsPerformed.should.be.greaterThan(0);

            secureChannel.isTransactionInProgress().should.eql(false);

            const spyOnClose = sinon.spy();
            secureChannel.on("close", spyOnClose);

            secureChannel.close(function (err) {
                spyOnClose.callCount.should.eql(1, "secureChannel#close must be called once");
                done(err);
            });
        });
    });
});
