const should = require("should");

const { StatusCodes } = require("node-opcua-status-code");

const {
    ServerSecureChannelLayer,
    MessageSecurityMode,
    SecurityPolicy
} = require("..");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const { DirectTransport } = require("node-opcua-transport/dist/test_helpers");
const { GetEndpointsResponse } = require("node-opcua-service-endpoints");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ServerSecureChannelLayer ", function() {

    this.timeout(10000);

    it("KK1 should create a ServerSecureChannelLayer", function() {

        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout.should.be.greaterThan(100);

        serverSecureChannel.dispose();

    });

    it("KK2 should end with a timeout if no message is received from client", function(done) {

        const node = new DirectTransport();
        const serverSecureChannel = new ServerSecureChannelLayer({
            timeout: 50,

        });

        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.init(node.server, function(err) {
            err.message.should.match(/Timeout/);

            serverSecureChannel.dispose();
            done();
        });

        serverSecureChannel.on("abort", function() {
            console.log("Abort");
        });
    });

    it("KK3 should end with a timeout if HEL/ACK is OK but no further message is received from client", function(done) {

        const node = new DirectTransport();

        let server_has_emitted_the_abort_message = false;

        const serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.init(node.server, function(err) {

            err.message.should.match(/Timeout waiting for OpenChannelRequest/);
            server_has_emitted_the_abort_message.should.eql(true);

            serverSecureChannel.dispose();
            done();

        });

        serverSecureChannel.on("abort", function() {
            server_has_emitted_the_abort_message = true;
        });

        // now
        const fake_HelloMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

    });

    it("KK4 should return an error and shutdown if first message is not OpenSecureChannelRequest ", function(done) {

        const node = new DirectTransport();

        let server_has_emitted_the_abort_message = false;
        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);


        serverSecureChannel.timeout = 1000;

        serverSecureChannel.init(node.server, function(err) {

            err.message.should.match(/Expecting OpenSecureChannelRequest/);


            serverSecureChannel.close(function() {
                serverSecureChannel.dispose();
                serverSecureChannel = null;
                server_has_emitted_the_abort_message.should.equal(true);
                done();
            });
        });

        serverSecureChannel.on("abort", function() {
            server_has_emitted_the_abort_message = true;
        });


        const fake_HelloMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        const fake_NotAOpenSecureChannelMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_3; // GetEndpointsRequest
        node.client.write(fake_NotAOpenSecureChannelMessage);

    });

    it("KK5 should handle a OpenSecureChannelRequest and pass no err in the init callback ", function(done) {

        const node = new DirectTransport();

        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50; // milliseconds !
        serverSecureChannel.init(node.server, function(err) {
            should.not.exist(err);
            serverSecureChannel.close(function() {
                serverSecureChannel.dispose();
                done();
            });
        });

        const fake_HelloMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        const fake_OpenSecureChannelRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_2; // OPN
        node.client.write(fake_OpenSecureChannelRequest);

        ///     serverSecureChannel.close(function () {
        ///            serverSecureChannel.dispose();
        ///      serverSecureChannel = null;
        /// });
    });

    it("KK6 should handle a OpenSecureChannelRequest start emitting subsequent messages ", function(done) {

        const node = new DirectTransport();

        const serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.channelId = 8;

        serverSecureChannel.init(node.server, function(err) {
            should.not.exist(err);

            setImmediate(() => {
                const fake_GetEndpointsRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_3; // GetEndPoints
                fake_GetEndpointsRequest.writeInt16LE(serverSecureChannel.channelId, 8);
                node.client.write(fake_GetEndpointsRequest);
            })
        });
        serverSecureChannel.on("message", function(message) {
            message.request.schema.name.should.equal("GetEndpointsRequest");
            setImmediate(function() {
                serverSecureChannel.close(function() {
                    serverSecureChannel.dispose();
                    done();
                });
            });
        });

        const fake_HelloMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        const fake_OpenSecureChannelRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_2; // OPN
        node.client.write(fake_OpenSecureChannelRequest);


        // serverSecureChannel.close(function() {
        //     serverSecureChannel.dispose();
        //     serverSecureChannel= null;
        //     done();
        // });
    });

    it("KK7 should handle a CloseSecureChannelRequest directly and emit a abort event", async function() {

        const node = new DirectTransport();

        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;
        serverSecureChannel.init(node.server, function(err) {
            should.not.exist(err);
        });

        let nb_on_message_calls = 0;
        serverSecureChannel.on("message", function(message) {

            console.log("message ", message.request.toString());
            message.request.schema.name.should.not.equal("CloseSecureChannelRequest");
            nb_on_message_calls.should.equal(0);
            nb_on_message_calls += 1;

            message.request.schema.name.should.equal("GetEndpointsRequest");
            serverSecureChannel.send_response("MSG", new GetEndpointsResponse(), message, () => {
            });
        });

        let isDone = false;
        serverSecureChannel.on("abort", function() {
            console.log("Receive Abort");
        });
        async function send(message) {
            await new Promise((resolve) => {
                node.client.once("data", resolve)
                node.client.write(message);
            });
        }
        async function send2(message) {
            await new Promise((resolve) => {
                serverSecureChannel.once("abort", resolve)
                node.client.write(message);
            });
        }
        console.log("writing Hello");
        const fake_HelloMessage = require("node-opcua-transport/dist/test-fixtures").packet_cs_1; // HEL
        await send(fake_HelloMessage);

        console.log("writing fake_OpenSecureChannelRequest");
        const fake_OpenSecureChannelRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_2; // OPN
        await send(fake_OpenSecureChannelRequest);

        console.log("writing fake_GetEndpointsRequest");
        const fake_GetEndpointsRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_3; // GEP
        fake_GetEndpointsRequest.writeInt16LE(serverSecureChannel.channelId, 8);
        await send(fake_GetEndpointsRequest);

        console.log("writing fake_CloseSecureChannelRequest");
        const fake_CloseSecureChannelRequest = require("node-opcua-transport/dist/test-fixtures").packet_cs_4; // CLO
        fake_CloseSecureChannelRequest.writeInt16LE(serverSecureChannel.channelId, 8);
        await send2(fake_CloseSecureChannelRequest);
        console.log("done with fake_CloseSecureChannelRequest");

        serverSecureChannel.dispose();
        serverSecureChannel = null;

        node.shutdown(() => {
            isDone = true;
        });

    });


});
