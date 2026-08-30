import "should";
import { OPCUAClient, type ServerSecureChannelLayer, type UAVariable } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device.js";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session.js";

// redirectToFile retained for potential future use
// import { redirectToFile } from "node-opcua-debug/nodeJS";

// _channels is a private OPCUAServerEndPoint field, reached here to observe raw
// secure-channel byte counters for the diagnostics assertion below.
interface ServerEndPointWithChannels {
    _channels: { [key: string]: ServerSecureChannelLayer };
}

describe("Testing Server and Client diagnostic facilities", function (this: Mocha.Context) {
    let server: Awaited<ReturnType<typeof build_server_with_temperature_device>>,
        client: OPCUAClient | null,
        _temperatureVariableId: UAVariable,
        endpointUrl: string;

    const port = 2015;
    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        server = await build_server_with_temperature_device({ port });

        endpointUrl = server.getEndpointUrl();
        _temperatureVariableId = server.temperatureVariableId;
    });

    beforeEach(() => {
        client = OPCUAClient.create({});
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    function extract_server_channel(): ServerSecureChannelLayer {
        const cp = server.endpoints[0] as unknown as ServerEndPointWithChannels;
        const ckey = Object.keys(cp._channels);
        return cp._channels[ckey[0]];
    }

    it("MM01- Server should keep track of transaction statistics", async () => {
        await perform_operation_on_client_session(client as OPCUAClient, endpointUrl, async (session) => {
            const localClient = client!; // non-null (created in beforeEach)
            const server_channel = extract_server_channel();
            let transactionCounter = localClient.transactionsPerformed;
            server_channel.on("transaction_done", () => {
                console.log(" Server bytes read : ", server_channel.bytesRead, " bytes written : ", server_channel.bytesWritten);
                console.log(" Client bytes read : ", localClient.bytesRead, " bytes written : ", localClient.bytesWritten);
                console.log(" transaction count : ", localClient.transactionsPerformed);
                localClient.bytesWritten.should.eql(server_channel.bytesRead);
                localClient.transactionsPerformed.should.eql(transactionCounter + 1);
                transactionCounter += 1;
            });
            const browseResult = await session.browse("RootFolder");
            (browseResult !== null && browseResult !== undefined).should.be.true();
        });
    });
});
