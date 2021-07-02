const should = require("should");

const { StatusCodes } = require("node-opcua-status-code");

const { ServerSecureChannelLayer, MessageSecurityMode, SecurityPolicy } = require("..");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const { DirectTransport } = require("node-opcua-transport/dist/test_helpers");
const { GetEndpointsResponse } = require("node-opcua-service-endpoints");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ServerSecureChannelLayer ", function () {
    this.timeout(10000);

    it("KK1 should create a ServerSecureChannelLayer", function () {
        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout.should.be.greaterThan(100);

        serverSecureChannel.dispose();
    });

    it("KK2 should end with a timeout if no message is received from client", function (done) {
        const node = new DirectTransport();
        const serverSecureChannel = new ServerSecureChannelLayer({
            timeout: 50
        });

        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.init(node.server, function (err) {
            err.message.should.match(/Timeout/);

            serverSecureChannel.dispose();
            done();
        });

        serverSecureChannel.on("abort", function () {
            console.log("Abort");
        });
    });

    it("KK3 should end with a timeout if HEL/ACK is OK but no further message is received from client", function (done) {
        const node = new DirectTransport();

        let server_has_emitted_the_abort_message = false;

        const serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.init(node.server, function (err) {
            err.message.should.match(/Timeout waiting for OpenChannelRequest/);
            server_has_emitted_the_abort_message.should.eql(true);

            serverSecureChannel.dispose();
            done();
        });

        serverSecureChannel.on("abort", function () {
            server_has_emitted_the_abort_message = true;
        });

        // now
        const { helloMessage1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        node.client.write(helloMessage1);
    });

    it("KK4 should return an error and shutdown if first message is not OpenSecureChannelRequest ", function (done) {
        const node = new DirectTransport();

        let server_has_emitted_the_abort_message = false;
        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        serverSecureChannel.timeout = 1000;

        serverSecureChannel.init(node.server, function (err) {
            err.message.should.match(/Expecting OpenSecureChannelRequest/);

            serverSecureChannel.close(function () {
                serverSecureChannel.dispose();
                serverSecureChannel = null;
                server_has_emitted_the_abort_message.should.equal(true);
                done();
            });
        });

        serverSecureChannel.on("abort", function () {
            server_has_emitted_the_abort_message = true;
        });

        const { helloMessage1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        node.client.write(helloMessage1);

        const { getEndpointsRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // GetEndpointsRequest
        node.client.write(getEndpointsRequest1);
    });

    it("KK5 should handle a OpenSecureChannelRequest and pass no err in the init callback ", function (done) {
        const node = new DirectTransport();

        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50; // milliseconds !
        serverSecureChannel.init(node.server, function (err) {
            should.not.exist(err);
            serverSecureChannel.close(function () {
                serverSecureChannel.dispose();
                done();
            });
        });

        const { helloMessage1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        node.client.write(helloMessage1);

        const { openChannelRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // OPN
        node.client.write(openChannelRequest1);

        ///     serverSecureChannel.close(function () {
        ///            serverSecureChannel.dispose();
        ///      serverSecureChannel = null;
        /// });
    });

    it("KK6 should handle a OpenSecureChannelRequest start emitting subsequent messages ", function (done) {
        const node = new DirectTransport();

        const serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;

        serverSecureChannel.channelId = 8;

        serverSecureChannel.init(node.server, function (err) {
            should.not.exist(err);

            setImmediate(() => {
                const { getEndpointsRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // GetEndPoints
                getEndpointsRequest1.writeInt16LE(serverSecureChannel.channelId, 8);
                node.client.write(getEndpointsRequest1);
            });
        });
        serverSecureChannel.on("message", function (message) {
            message.request.schema.name.should.equal("GetEndpointsRequest");
            setImmediate(function () {
                serverSecureChannel.close(function () {
                    serverSecureChannel.dispose();
                    done();
                });
            });
        });

        const { helloMessage1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        node.client.write(helloMessage1);

        const { openChannelRequest1  } = require("node-opcua-transport/dist/test-fixtures"); // OPN
        node.client.write(openChannelRequest1);

        // serverSecureChannel.close(function() {
        //     serverSecureChannel.dispose();
        //     serverSecureChannel= null;
        //     done();
        // });
    });

    it("KK7 should handle a CloseSecureChannelRequest directly and emit a abort event", async function () {
        const node = new DirectTransport();

        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;
        serverSecureChannel.init(node.server, function (err) {
            should.not.exist(err);
        });

        let nb_on_message_calls = 0;
        serverSecureChannel.on("message", function (message) {
            console.log("message ", message.request.toString());
            message.request.schema.name.should.not.equal("CloseSecureChannelRequest");
            nb_on_message_calls.should.equal(0);
            nb_on_message_calls += 1;

            message.request.schema.name.should.equal("GetEndpointsRequest");
            serverSecureChannel.send_response("MSG", new GetEndpointsResponse(), message, () => {});
        });

        let isDone = false;
        serverSecureChannel.on("abort", function () {
            console.log("Receive Abort");
        });
        async function send(message) {
            await new Promise((resolve) => {
                node.client.once("data", resolve);
                node.client.write(message);
            });
        }
        async function send2(message) {
            await new Promise((resolve) => {
                serverSecureChannel.once("abort", resolve);
                node.client.write(message);
            });
        }
        console.log("writing Hello");
        const { helloMessage1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        await send(helloMessage1);

        console.log("writing fake_OpenSecureChannelRequest");
        const { openChannelRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // OPN
        await send(openChannelRequest1);

        console.log("writing fake_GetEndpointsRequest");
        const { getEndpointsRequest1  } = require("node-opcua-transport/dist/test-fixtures"); // GEP
        getEndpointsRequest1.writeInt16LE(serverSecureChannel.channelId, 8);
        await send(getEndpointsRequest1);

        console.log("writing fake_CloseSecureChannelRequest");
        const { closeSecureChannelRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // CLO
        closeSecureChannelRequest1.writeInt16LE(serverSecureChannel.channelId, 8);
        await send2(closeSecureChannelRequest1);
        console.log("done with fake_CloseSecureChannelRequest");

        serverSecureChannel.dispose();
        serverSecureChannel = null;

        node.shutdown(() => {
            isDone = true;
        });
    });

    function fuzzTest(messages, done) {
        const node = new DirectTransport();

        let server_has_emitted_the_abort_message = false;
        let serverSecureChannel = new ServerSecureChannelLayer({});
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        serverSecureChannel.timeout = 1000;

        serverSecureChannel.init(node.server, function (err) {
            err.message.should.match(/Expecting OpenSecureChannelRequest/);

            serverSecureChannel.close(function () {
                serverSecureChannel.dispose();
                serverSecureChannel = null;
                server_has_emitted_the_abort_message.should.equal(true);
                done();
            });
        });

        serverSecureChannel.on("abort", function () {
            server_has_emitted_the_abort_message = true;
        });

        for (const m of messages) {
            node.client.write(m);
        }
    }
    it("FUZZ4- should not crash with a corrupted openChannelRequest message", (done) => {
        const { helloMessage1, getEndpointsRequest1 } = require("node-opcua-transport/dist/test-fixtures");
        fuzzTest([helloMessage1, getEndpointsRequest1], done);
    });
    it("FUZZ5- should not crash with a corrupted openChannelRequest message", (done) => {
        const { helloMessage1, altered_openChannelRequest1 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        fuzzTest([helloMessage1, altered_openChannelRequest1], done);
    });
    it("FUZZ6- should not crash with a corrupted openChannelRequest message", (done) => {
        const { helloMessage1, altered_openChannelRequest2 } = require("node-opcua-transport/dist/test-fixtures"); // HEL
        fuzzTest([helloMessage1, altered_openChannelRequest2], done);
    });
});
