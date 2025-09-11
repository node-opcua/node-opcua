import "should";
import { OPCUAClient, NodeId, NodeIdType, BrowseDirection, StatusCode, StatusCodes } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server?: any; [k: string]: any }

export function t(test: TestHarness) {
    describe("Issue #377 - string nodeId that looks like a guid", () => {
        const guidLikeString = "1cf5e1fa-202a-2ab8-0440-c4fc2f22f2bf"; // looks like a GUID but is a string nodeId
        before(() => {
            if (!test.server) return; // skip if no embedded server
            const addressSpace = test.server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();
            const nodeId = new NodeId(NodeIdType.STRING, guidLikeString, 1);
            if (!addressSpace.findNode(nodeId)) {
                namespace.addObject({
                    browseName: "Node377",
                    nodeId,
                    organizedBy: addressSpace.rootFolder.objects
                });
            }
        });

        it("#377 browse should list the string nodeId without confusion", async () => {
            if (!test.server) return; // skip when server not provided
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const browseDesc = { nodeId: "ObjectsFolder", referenceTypeId: null, browseDirection: BrowseDirection.Forward } as any;
                const browseResult = await session.browse(browseDesc);

                browseResult.should.have.property("references");
                browseResult.references!.should.be.an.Array();
                browseResult.references!.should.not.be.empty();
                browseResult.statusCode.should.eql(StatusCodes.Good);
                
                const nodeIds = browseResult.references!.map((r: any) => r.nodeId.toString());
                nodeIds.should.containEql(`ns=1;s=${guidLikeString}`);
            });
        });
    });
}