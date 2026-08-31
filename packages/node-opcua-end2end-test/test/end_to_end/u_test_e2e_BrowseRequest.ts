import {
    BrowseDescription,
    BrowseDirection,
    BrowseNextRequest,
    type BrowseNextResponse,
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
    performMessageTransaction(
        request: BrowseRequest | BrowseNextRequest,
        callback: (err: Error | null, response?: BrowseResponse | BrowseNextResponse) => void
    ): void;
}

function performMessageTransaction<T extends BrowseResponse | BrowseNextResponse>(
    session: ClientSession,
    request: BrowseRequest | BrowseNextRequest
): Promise<T> {
    return new Promise((resolve, reject) => {
        (session as unknown as SessionWithTransaction).performMessageTransaction(request, (err, response) => {
            if (err) return reject(err);
            resolve(response as T);
        });
    });
}

async function expectErrorMessage(re: RegExp, fn: () => Promise<unknown>) {
    let ok = false;
    try {
        await fn();
    } catch (err: unknown) {
        (err as Error).message.should.match(re);
        ok = true;
    }
    if (!ok) throw new Error(`Expected error matching ${re}`);
}

export function t(test: UmbrellaTestContext) {
    describe("Test Browse Request", () => {
        let client: OPCUAClient;
        let session: ClientSession;
        let endpointUrl: string;

        beforeEach(async () => {
            endpointUrl = test.endpointUrl!;
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
            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                browseDirection: BrowseDirection.Forward
            };
            const browseRequest = new BrowseRequest({ view: { viewId: "ns=1256;i=1" }, nodesToBrowse: [browseDesc] });
            await expectErrorMessage(/BadViewIdUnknown/, async () => {
                await performMessageTransaction(session, browseRequest);
            });
        });

        it("T3 - viewId refers to non-view object -> BadViewIdUnknown", async () => {
            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                browseDirection: BrowseDirection.Forward
            };
            const browseRequest = new BrowseRequest({ view: { viewId: "ns=0;i=85" }, nodesToBrowse: [browseDesc] });
            await expectErrorMessage(/BadViewIdUnknown/, async () => {
                await performMessageTransaction(session, browseRequest);
            });
        });

        it("T4 - server respects requestedMaxReferencesPerNode", async () => {
            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                includeSubtypes: true,
                browseDirection: BrowseDirection.Both,
                resultMask: 63
            };

            // large limit
            const browseRequest1 = new BrowseRequest({
                requestedMaxReferencesPerNode: 10,
                nodesToBrowse: [browseDesc]
            });
            let response = await performMessageTransaction<BrowseResponse>(session, browseRequest1);
            should(response.results?.[0].statusCode).eql(StatusCodes.Good);
            should(response.results?.[0].references?.length).be.greaterThan(3);
            (response.results![0].continuationPoint === null).should.eql(true);

            // small limit -> continuation point expected
            const browseRequest2 = new BrowseRequest({
                requestedMaxReferencesPerNode: 1,
                nodesToBrowse: [browseDesc]
            });
            response = await performMessageTransaction<BrowseResponse>(session, browseRequest2);
            should(response.results?.[0].statusCode).eql(StatusCodes.Good);
            should(response.results?.[0].references?.length).eql(1);
            (response.results![0].continuationPoint !== null).should.eql(true);
        });

        it("T5 - BrowseNext with no continuationPoints -> BadNothingToDo", async () => {
            const browseNextRequest = new BrowseNextRequest({ continuationPoints: null });
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await performMessageTransaction(session, browseNextRequest);
            });
        });

        it("T6 - BrowseNext sequence consumption and invalidation", async () => {
            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                includeSubtypes: true,
                browseDirection: BrowseDirection.Both,
                resultMask: 63
            };
            // full browse to capture references
            const fullReq = new BrowseRequest({
                requestedMaxReferencesPerNode: 10,
                nodesToBrowse: [browseDesc]
            });
            let resp = await performMessageTransaction<BrowseResponse>(session, fullReq);
            should(resp.results?.[0].statusCode).eql(StatusCodes.Good);
            should(resp.results?.[0].references?.length).be.greaterThan(3);
            const allReferences = resp.results![0].references!;

            // limited browse to receive continuation point
            const limitedReq = new BrowseRequest({
                requestedMaxReferencesPerNode: 2,
                nodesToBrowse: [browseDesc]
            });
            resp = await performMessageTransaction<BrowseResponse>(session, limitedReq);
            should(resp.results?.length).eql(1);
            should(resp.results?.[0].statusCode).eql(StatusCodes.Good);
            should(resp.results?.[0].references?.length).eql(2);
            should(resp.results?.[0].references?.[0]).eql(allReferences[0]);
            should(resp.results?.[0].references?.[1]).eql(allReferences[1]);
            const continuationPoint = resp.results![0].continuationPoint;
            (continuationPoint !== null).should.eql(true);

            // BrowseNext to get next chunk
            const browseNextRequest1 = new BrowseNextRequest({ continuationPoints: [continuationPoint] });
            let respNext = await performMessageTransaction<BrowseNextResponse>(session, browseNextRequest1);
            respNext.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            should(respNext.results?.[0].references?.length).eql(2);
            should(respNext.results?.[0].references?.[0]).eql(allReferences[2]);
            should(respNext.results?.[0].references?.[1]).eql(allReferences[3]);
            (respNext.results![0].continuationPoint === null).should.eql(true);

            // reusing exhausted continuationPoint should yield BadContinuationPointInvalid
            const browseNextRequest2 = new BrowseNextRequest({
                continuationPoints: [continuationPoint],
                releaseContinuationPoints: true
            });
            respNext = await performMessageTransaction<BrowseNextResponse>(session, browseNextRequest2);
            respNext.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            should(respNext.results?.[0].statusCode).eql(StatusCodes.BadContinuationPointInvalid);
        });

        const IT = test.server ? it : xit;
        IT("T7 - BrowseNext releaseContinuationPoints toggle behavior", async () => {
            async function test_5_7_2__9(nodeIdStr: string) {
                const nodeId = resolveNodeId(nodeIdStr);
                const obj = test.server!.engine!.addressSpace!.findNode(nodeId)!;
                obj.should.be.ok();
                const browseDesc = new BrowseDescription({
                    nodeId,
                    referenceTypeId: "i=47", // HasComponents
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });

                // browse all references
                const respAll = await performMessageTransaction<BrowseResponse>(
                    session,
                    new BrowseRequest({ requestedMaxReferencesPerNode: 10, nodesToBrowse: [browseDesc] })
                );
                should(respAll.results?.[0].references?.length).be.greaterThan(3);
                const allReferences = respAll.results![0].references!;

                // first limited browse (max 1)
                const resp1 = await performMessageTransaction<BrowseResponse>(
                    session,
                    new BrowseRequest({ requestedMaxReferencesPerNode: 1, nodesToBrowse: [browseDesc] })
                );
                should(resp1.results?.[0].references?.length).eql(1);
                should(resp1.results?.[0].references?.[0]).eql(allReferences[0]);
                const continuationPoint = resp1.results![0].continuationPoint;
                (continuationPoint !== null).should.eql(true);

                // BrowseNext keep continuation
                const bn1 = await performMessageTransaction<BrowseNextResponse>(
                    session,
                    new BrowseNextRequest({ releaseContinuationPoints: false, continuationPoints: [continuationPoint] })
                );
                should(bn1.results?.[0].references?.length).eql(1);
                should(bn1.results?.[0].references?.[0]).eql(allReferences[1]);
                (bn1.results![0].continuationPoint !== null).should.eql(true);

                // BrowseNext release continuation (now empty)
                const bn2 = await performMessageTransaction<BrowseNextResponse>(
                    session,
                    new BrowseNextRequest({ releaseContinuationPoints: true, continuationPoints: [continuationPoint] })
                );
                should(bn2.results?.[0].references?.length).eql(0);
                (bn2.results![0].continuationPoint === null).should.eql(true);
            }
            await test_5_7_2__9("ns=0;i=2253");
        });
    });
}
