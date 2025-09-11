import "should";
import {
    resolveNodeId,
    OPCUAClient,
    StatusCodes,
    BrowseDirection,
    BrowseRequest,
    BrowseNextRequest,
    BrowseDescription
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

function performMessageTransaction(session: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        session.performMessageTransaction(request, (err: any, response: any) => {
            if (err) return reject(err);
            resolve(response);
        });
    });
}

async function expectErrorMessage(re: RegExp, fn: () => Promise<any>) {
    let ok = false;
    try {
        await fn();
    } catch (err: any) {
        err.message.should.match(re);
        ok = true;
    }
    if (!ok) throw new Error("Expected error matching " + re);
}

export function t(test: TestHarness) {
    describe("Test Browse Request", () => {
        let client: any; let session: any; let endpointUrl: string;

        beforeEach(async () => {
            endpointUrl = test.endpointUrl;
            client = OPCUAClient.create({});
            await client.connect(endpointUrl);
            session = await client.createSession();
        });

        afterEach(async () => {
            if (session) await session.close();
            if (client) await client.disconnect();
        });

        it("T1 - Browse empty nodesToBrowse -> BadNothingToDo", async () => {
            const browseRequest = new BrowseRequest({ nodesToBrowse: [] });
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await performMessageTransaction(session, browseRequest);
            });
        });

        it("T2 - invalid viewId -> BadViewIdUnknown", async () => {
            const browseDesc = { nodeId: resolveNodeId("RootFolder"), referenceTypeId: null, browseDirection: BrowseDirection.Forward };
            const browseRequest = new BrowseRequest({ view: { viewId: "ns=1256;i=1" }, nodesToBrowse: [browseDesc] });
            await expectErrorMessage(/BadViewIdUnknown/, async () => {
                await performMessageTransaction(session, browseRequest);
            });
        });

        it("T3 - viewId refers to non-view object -> BadViewIdUnknown", async () => {
            const browseDesc = { nodeId: resolveNodeId("RootFolder"), referenceTypeId: null, browseDirection: BrowseDirection.Forward };
            const browseRequest = new BrowseRequest({ view: { viewId: "ns=0;i=85" }, nodesToBrowse: [browseDesc] });
            await expectErrorMessage(/BadViewIdUnknown/, async () => {
                await performMessageTransaction(session, browseRequest);
            });
        });

        it("T4 - server respects requestedMaxReferencesPerNode", async () => {
            const browseDesc = { nodeId: resolveNodeId("RootFolder"), referenceTypeId: null, includeSubtypes: true, browseDirection: BrowseDirection.Both, resultMask: 63 };

            // large limit
            let browseRequest1 = new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 10, nodesToBrowse: [browseDesc] });
            let response: any = await performMessageTransaction(session, browseRequest1);
            response.results[0].statusCode.should.eql(StatusCodes.Good);
            response.results[0].references.length.should.be.greaterThan(3);
            (response.results[0].continuationPoint === null).should.eql(true);

            // small limit -> continuation point expected
            let browseRequest2 = new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 1, nodesToBrowse: [browseDesc] });
            response = await performMessageTransaction(session, browseRequest2);
            response.results[0].statusCode.should.eql(StatusCodes.Good);
            response.results[0].references.length.should.eql(1);
            (response.results[0].continuationPoint !== null).should.eql(true);
        });

        it("T5 - BrowseNext with no continuationPoints -> BadNothingToDo", async () => {
            const browseNextRequest = new BrowseNextRequest({ continuationPoints: null as any });
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await performMessageTransaction(session, browseNextRequest);
            });
        });

        it("T6 - BrowseNext sequence consumption and invalidation", async () => {
            const browseDesc = { nodeId: resolveNodeId("RootFolder"), referenceTypeId: null, includeSubtypes: true, browseDirection: BrowseDirection.Both, resultMask: 63 };
            // full browse to capture references
            const fullReq = new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 10, nodesToBrowse: [browseDesc] });
            let resp: any = await performMessageTransaction(session, fullReq);
            resp.results[0].statusCode.should.eql(StatusCodes.Good);
            resp.results[0].references.length.should.be.greaterThan(3);
            const allReferences = resp.results[0].references;

            // limited browse to receive continuation point
            const limitedReq = new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 2, nodesToBrowse: [browseDesc] });
            resp = await performMessageTransaction(session, limitedReq);
            resp.results.length.should.eql(1);
            resp.results[0].statusCode.should.eql(StatusCodes.Good);
            resp.results[0].references.length.should.eql(2);
            resp.results[0].references[0].should.eql(allReferences[0]);
            resp.results[0].references[1].should.eql(allReferences[1]);
            const continuationPoint = resp.results[0].continuationPoint;
            (continuationPoint !== null).should.eql(true);

            // BrowseNext to get next chunk
            const browseNextRequest1 = new BrowseNextRequest({ continuationPoints: [continuationPoint] });
            let respNext: any = await performMessageTransaction(session, browseNextRequest1);
            respNext.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            respNext.results[0].references.length.should.eql(2);
            respNext.results[0].references[0].should.eql(allReferences[2]);
            respNext.results[0].references[1].should.eql(allReferences[3]);
            (respNext.results[0].continuationPoint === null).should.eql(true);

            // reusing exhausted continuationPoint should yield BadContinuationPointInvalid
            const browseNextRequest2 = new BrowseNextRequest({ continuationPoints: [continuationPoint], releaseContinuationPoints: true });
            respNext = await performMessageTransaction(session, browseNextRequest2);
            respNext.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            respNext.results[0].statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });

        const IT = test.server ? it : xit;
        IT("T7 - BrowseNext releaseContinuationPoints toggle behavior", async () => {
            async function test_5_7_2__9(nodeIdStr: string) {
                const nodeId = resolveNodeId(nodeIdStr);
                const obj = test.server.engine.addressSpace.findNode(nodeId);
                obj.should.be.ok();
                const browseDesc = new BrowseDescription({
                    nodeId,
                    referenceTypeId: "i=47", // HasComponents
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });

                // browse all references
                let respAll = await performMessageTransaction(session, new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 10, nodesToBrowse: [browseDesc] }));
                respAll.results[0].references.length.should.be.greaterThan(3);
                const allReferences = respAll.results[0].references;

                // first limited browse (max 1)
                let resp1 = await performMessageTransaction(session, new BrowseRequest({ view: null as any, requestedMaxReferencesPerNode: 1, nodesToBrowse: [browseDesc] }));
                resp1.results[0].references.length.should.eql(1);
                resp1.results[0].references[0].should.eql(allReferences[0]);
                const continuationPoint = resp1.results[0].continuationPoint;
                (continuationPoint !== null).should.eql(true);

                // BrowseNext keep continuation
                let bn1 = await performMessageTransaction(session, new BrowseNextRequest({ releaseContinuationPoints: false, continuationPoints: [continuationPoint] }));
                bn1.results[0].references.length.should.eql(1);
                bn1.results[0].references[0].should.eql(allReferences[1]);
                (bn1.results[0].continuationPoint !== null).should.eql(true);

                // BrowseNext release continuation (now empty)
                let bn2 = await performMessageTransaction(session, new BrowseNextRequest({ releaseContinuationPoints: true, continuationPoints: [continuationPoint] }));
                bn2.results[0].references.length.should.eql(0);
                (bn2.results[0].continuationPoint === null).should.eql(true);
            }
            await test_5_7_2__9("ns=0;i=2253");
        });
    });
}
