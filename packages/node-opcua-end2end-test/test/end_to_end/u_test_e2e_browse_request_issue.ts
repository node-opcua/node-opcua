import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import {
    OPCUAClient,
    resolveNodeId,
    StatusCodes,
    BrowseDirection,
    BrowseRequest
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness {
    endpointUrl: string;
    server: any;
}

export  function t(test: TestHarness): void {
    describe("QSD Test Browse Request", function () {
        let client: OPCUAClient; 
        let endpointUrl: string;
        let g_session: any = null; // session typing loosened due to performMessageTransaction unexposed type

        beforeEach(async () => {
            endpointUrl = test.endpointUrl;
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
            g_session = null as any;
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
                view: null as any,
                requestedMaxReferencesPerNode: 0,
                nodesToBrowse: [nodeToBrowse]
            });
            const response = await (g_session as any).performMessageTransaction(browseRequest1);
            response.results[0].statusCode.should.eql(StatusCodes.Good);
            response.results[0].references.length.should.be.greaterThan(3); // want 4 at least
            should(response.results[0].continuationPoint).eql(null);
        });
    });
}