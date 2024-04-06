/* eslint-disable max-statements */
"use strict";
import { OPCUAClient, OPCUAServer, NodeId } from "node-opcua";
import "mocha";
import "should";

import { make_debugLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 2014;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const f = require("../../test_helpers/display_function_name").f.bind(null, doDebug);

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client.isReconnecting flag behavior", function (this: Mocha.Test) {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    this.timeout(Math.max(20000, this.timeout()));

    before(async () => {
        server = await build_server_with_temperature_device({ port });
        endpointUrl = server.getEndpointUrl();
    });
    after(async () => {
        await server.shutdown();
    });

    it("client.isReconnecting should be true when client emits reconnection event", async () => {
        client = OPCUAClient.create({});

        let isReconnectingValueWhenConnectionLostEventIsEmitted = false;
        client.on("connection_lost", () => {
            isReconnectingValueWhenConnectionLostEventIsEmitted = client.isReconnecting;
        });
        let isReconnectingValueWhenStartReconnectionIsEmitted = false;
        client.on("start_reconnection", () => {
            isReconnectingValueWhenStartReconnectionIsEmitted = client.isReconnecting;
        });

        let isReconnectingValueWhenReconnectionEventIsEmitted = false;
        client.on("connection_reestablished", () => {
            isReconnectingValueWhenReconnectionEventIsEmitted = client.isReconnecting;
        });

        await client.connect(endpointUrl);
        client.isReconnecting.should.eql(false);

        await new Promise((resolve) => {
            server.shutdown();
            client.once("start_reconnection", resolve);
        });
        client.isReconnecting.should.eql(true);

        await new Promise((resolve) => {
            (async () => {
                server = await build_server_with_temperature_device({ port });
            })();
            client.once("connection_reestablished", resolve);
        });

        client.isReconnecting.should.eql(false);

        await client.disconnect();

        isReconnectingValueWhenConnectionLostEventIsEmitted.should.be.eql(true);
        isReconnectingValueWhenStartReconnectionIsEmitted.should.be.eql(true);
        isReconnectingValueWhenReconnectionEventIsEmitted.should.be.eql(false);
    });
});
