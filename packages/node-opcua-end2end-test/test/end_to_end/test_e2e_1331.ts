import {
    OPCUAClient,
    OPCUAServer
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import "should";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";

const port = 2014;

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

        await new Promise<void>((resolve) => {
            (async () => {
                server = await build_server_with_temperature_device({ port });
            })();
            client.once("connection_reestablished", () => resolve());
        });

        client.isReconnecting.should.eql(false);

        await client.disconnect();

        isReconnectingValueWhenConnectionLostEventIsEmitted.should.be.eql(true);
        isReconnectingValueWhenStartReconnectionIsEmitted.should.be.eql(true);
        isReconnectingValueWhenReconnectionEventIsEmitted.should.be.eql(false);
    });
});
