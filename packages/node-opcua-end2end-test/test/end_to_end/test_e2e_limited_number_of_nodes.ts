// --------------------------------------------------------------------------------------------
// Modern TypeScript version of limited node operation tests.
// Validates server operationLimits (read, browse, translate) enforcement and crawler behavior
// under constrained maxNodesPer* settings. Original JS archived as test_e2e_limited_number_of_nodes-old.js
// --------------------------------------------------------------------------------------------
import "should"; // assertion side-effects
import * as should from "should"; // explicit import to silence TS UMD global warning
import {
    makeNodeId,
    VariableIds,
    AttributeIds,
    assert,
    OPCUAServer,
    OPCUAClient,
    BrowseDirection,
    makeBrowsePath,
    ObjectIds
} from "node-opcua";
import { NodeCrawler } from "node-opcua-client-crawler";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

assert(typeof makeBrowsePath === "function");

const port = 2227;

describe("testing server with low maxNodesPerRead and maxNodesPerBrowse", function (this: Mocha.Context) {
    this.timeout(Math.max(this.timeout(), 10_000));

    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    before(async () => {
        server = new OPCUAServer({
            port,
            // xx nodeset_filename: empty_nodeset_filename,
            serverCapabilities: {
                maxSessions: 1,
                maxArrayLength: 0,
                maxStringLength: 0,
                maxBrowseContinuationPoints: 0,
                maxQueryContinuationPoints: 0,
                maxHistoryContinuationPoints: 0,
                // new in 1.05
                maxSubscriptions: 10,
                maxSubscriptionsPerSession: 3,
                maxMonitoredItemsQueueSize: 11,
                minSupportedSampleRate: 222,
                operationLimits: {
                    maxNodesPerRead: 10,
                    maxNodesPerWrite: 10,
                    maxNodesPerMethodCall: 10,
                    maxNodesPerBrowse: 2,
                    maxNodesPerRegisterNodes: 3,
                    maxNodesPerNodeManagement: 4,
                    maxMonitoredItemsPerCall: 120,
                    maxNodesPerHistoryReadData: 5,
                    maxNodesPerHistoryReadEvents: 6,
                    maxNodesPerHistoryUpdateData: 7,
                    maxNodesPerHistoryUpdateEvents: 8,
                    maxNodesPerTranslateBrowsePathsToNodeIds: 9
                }
            } as any
        });
        client = OPCUAClient.create({});
        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await client.disconnect();
        await server.shutdown();
        (OPCUAServer as any).registry.count().should.eql(0);
    });

    it("should be possible to customize serverCapabilities.operationLimits at construction time", () => {
        const caps: any = (server as any).engine.serverCapabilities;
        caps.minSupportedSampleRate.should.eql(222);
        caps.maxMonitoredItemsQueueSize.should.eql(11);
        caps.operationLimits.maxNodesPerRead.should.eql(10);
        caps.operationLimits.maxNodesPerWrite.should.eql(10);
        caps.operationLimits.maxNodesPerMethodCall.should.eql(10);
        caps.operationLimits.maxNodesPerBrowse.should.eql(2);
        caps.operationLimits.maxNodesPerRegisterNodes.should.eql(3);
        caps.operationLimits.maxNodesPerNodeManagement.should.eql(4);
        caps.operationLimits.maxMonitoredItemsPerCall.should.eql(120);
        caps.operationLimits.maxNodesPerHistoryReadData.should.eql(5);
        caps.operationLimits.maxNodesPerHistoryReadEvents.should.eql(6);
        caps.operationLimits.maxNodesPerHistoryUpdateData.should.eql(7);
        caps.operationLimits.maxNodesPerHistoryUpdateEvents.should.eql(8);
        caps.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds.should.eql(9);
    });

    it("server should provide OperationLimits_MaxNodesPerRead node", async () => {
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            const caps: any = (server as any).engine.serverCapabilities;
            caps.operationLimits.maxNodesPerRead.should.eql(10);
            const nodeId1 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
            const nodeToRead = { nodeId: nodeId1, attributeId: AttributeIds.Value };
            const dataValue = await (session as any).read(nodeToRead);
            dataValue.value.value.should.eql(caps.operationLimits.maxNodesPerRead);
        });
    });

    it("server should return BadTooManyOperations when nodesToRead exceed MaxNodesPerRead", async () => {
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            const caps: any = (server as any).engine.serverCapabilities;
            const nodeId1 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
            const nodeId2 = makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
            const nodesToRead = Array.from({ length: 12 }, (_, i) => ({ nodeId: i % 2 ? nodeId2 : nodeId1, attributeId: AttributeIds.Value }));
            nodesToRead.length.should.be.greaterThan(caps.operationLimits.maxNodesPerRead);
            await new Promise<void>((resolve) => {
                (session as any).read(nodesToRead, (err: Error | null) => {
                    should.exist(err);
                    (err as Error).message.should.match(/BadTooManyOperations/);
                    resolve();
                });
            });
        });
    });

    it("server should return BadTooManyOperations when browseRequest exceed MaxNodesPerBrowse", async () => {
        const caps: any = (server as any).engine.serverCapabilities;
        caps.operationLimits.maxNodesPerBrowse.should.equal(2);
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            const bad_referenceid_node = "ns=3;i=3500";
            const browseDesc = { nodeId: "ObjectsFolder", referenceTypeId: bad_referenceid_node, browseDirection: BrowseDirection.Forward };
            const browseRequest = Array.from({ length: 5 }, () => browseDesc);
            browseRequest.length.should.be.greaterThan(caps.operationLimits.maxNodesPerBrowse);
            await new Promise<void>((resolve) => {
                (session as any).browse(browseRequest, (err: Error | null) => {
                    should.exist(err);
                    (err as Error).message.should.match(/BadTooManyOperations/);
                    resolve();
                });
            });
        });
    });

    it("server should return BadTooManyOperations when translate exceeds limit", async () => {
        const caps: any = (server as any).engine.serverCapabilities;
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            const translateBrowsePath = Array.from({ length: 10 }, () => makeBrowsePath("RootFolder", "/Objects/Server"));
            caps.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds.should.be.greaterThan(1);
            translateBrowsePath.length.should.be.greaterThan(caps.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds);
            await new Promise<void>((resolve) => {
                (session as any).translateBrowsePath(translateBrowsePath, (err: Error | null) => {
                    should.exist(err);
                    (err as Error).message.should.match(/BadTooManyOperations/);
                    resolve();
                });
            });
        });
    });

    it("crawler shall work even with low read/browse limits", async () => {
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            const crawler = new NodeCrawler(session as any);
            crawler.on("browsed", (_element) => { /* hook retained for potential debug */ });
            await new Promise<void>((resolve, reject) => {
                crawler.read(ObjectIds.Server, (err: Error | null) => {
                    crawler.dispose();
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    });

    xit("should crawl a server cyclic-node", async () => {
        const namespace = (server as any).engine.addressSpace.getOwnNamespace();
        // TODO: implement cyclic node creation test scenario
        (server as any).subFolder1 = namespace.addFolder("ObjectsFolder", "SubFolder1");
        (server as any).subFolder2 = namespace.addFolder((server as any).subFolder1, "SubFolder2");
    });
});
