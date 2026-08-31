import {
    BrowseDirection,
    BrowseRequest,
    type BrowseResponse,
    type ClientSession,
    OPCUAClient,
    resolveNodeId,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

interface SessionWithTransaction {
    performMessageTransaction(request: BrowseRequest): Promise<BrowseResponse>;
}

export function t(test: UmbrellaTestContext): void {
    describe("QSD Test Browse Request", () => {
        let client: OPCUAClient;
        let endpointUrl: string;
        let g_session: ClientSession | null = null;

        beforeEach(async () => {
            endpointUrl = test.endpointUrl!;
            client = OPCUAClient.create({});
            await client.connect(endpointUrl);
            g_session = await client.createSession();
        });

        afterEach(async () => {
            try {
                if (g_session) {
                    await g_session.close();
                }
            } finally {
                if (client) {
                    await client.disconnect();
                }
            }
            g_session = null;
        });

        it("T6 - #BrowseNext response", async () => {
            const nodeToBrowse = {
                nodeId: resolveNodeId("i=29"),
                referenceTypeId: null,
                includeSubtypes: false,
                browseDirection: BrowseDirection.Forward,
                resultMask: 63,
                nodeClassMask: 255
            };
            const browseRequest1 = new BrowseRequest({
                requestedMaxReferencesPerNode: 0,
                nodesToBrowse: [nodeToBrowse]
            });
            const response = await (g_session as unknown as SessionWithTransaction).performMessageTransaction(browseRequest1);
            should(response.results?.[0].statusCode).eql(StatusCodes.Good);
            should(response.results?.[0].references?.length).be.greaterThan(3); // want 4 at least
            should(response.results![0].continuationPoint).eql(null);
        });
    });
}
