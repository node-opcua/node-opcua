import * as should from "should";
import { ContinuationPoint, nodesets, StatusCodes } from "node-opcua";
import { OPCUAServer } from "node-opcua-server";
import { date_add } from "node-opcua-address-space/testHelpers";
import {
    OPCUAClient,
    ClientSession,
    ReadRawModifiedDetails,
    HistoryReadRequest,
    TimestampsToReturn,
    HistoryData,
    NodeId,
    StatusCode,
    DataValue
} from "node-opcua-client";

const port = 2076;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node historyRead with continuation points", () => {
    const today = new Date("2017-01-01T00:00:00.000Z");
    let server: OPCUAServer;
    let nodeId: NodeId;
    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard]
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;

        const namespace = addressSpace.registerNamespace("MyPrivateNamespace");
        namespace.namespaceUri.should.eql("MyPrivateNamespace");
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar2",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        nodeId = node.nodeId;
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 100
        });
        // let's inject some values into the history

        node.setValueFromSource({ dataType: "Double", value: 0 }, StatusCodes.Good, date_add(today, { seconds: 0 }));
        node.setValueFromSource({ dataType: "Double", value: 1 }, StatusCodes.Good, date_add(today, { seconds: 1 }));
        node.setValueFromSource({ dataType: "Double", value: 2 }, StatusCodes.Good, date_add(today, { seconds: 2 }));
        node.setValueFromSource({ dataType: "Double", value: 3 }, StatusCodes.Good, date_add(today, { seconds: 3 }));
        node.setValueFromSource({ dataType: "Double", value: 4 }, StatusCodes.Good, date_add(today, { seconds: 4 }));
        node.setValueFromSource({ dataType: "Double", value: 5 }, StatusCodes.Good, date_add(today, { seconds: 5 }));
        node.setValueFromSource({ dataType: "Double", value: 6 }, StatusCodes.Good, date_add(today, { seconds: 6 }));

        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });

    it("should readHistory with continuation point", async () => {
        const endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: 1000 }),
                isReadModified: false,
                numValuesPerNode: 3, // three at a time
                returnBounds: false,
                startTime: date_add(today, { seconds: -10 })
            });
            const indexRange = undefined;
            const dataEncoding = undefined;

            const readRequest = new HistoryReadRequest({
                nodesToRead: [{ nodeId, indexRange, dataEncoding, continuationPoint: undefined }],
                historyReadDetails,
                releaseContinuationPoints: false,
                timestampsToReturn: TimestampsToReturn.Both
            });
            const historyReadResponse = await session.historyRead(readRequest);
            const historyReadResult = historyReadResponse.results![0];
            historyReadResult.statusCode.should.eql(StatusCodes.Good);

            const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
            dataValues.length.should.eql(3);
            should.exist(historyReadResult.continuationPoint, "expecting a continuation point in our case");

            const continuationPoint = historyReadResult.continuationPoint;
            dataValues[0].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 0 }).getTime());
            dataValues[1].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 1 }).getTime());
            dataValues[2].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 2 }).getTime());

            //  make_first_continuation_read(callback) {
            const historyReadResponse2 = await session.historyRead(
                new HistoryReadRequest({
                    nodesToRead: [{ nodeId, indexRange, dataEncoding, continuationPoint }],
                    historyReadDetails,
                    releaseContinuationPoints: false,
                    timestampsToReturn: TimestampsToReturn.Both
                })
            );
            const historyReadResult2 = historyReadResponse2.results![0];
            historyReadResult2.statusCode.should.eql(StatusCodes.Good);

            const dataValues2 = (historyReadResult2.historyData as HistoryData).dataValues!;
            dataValues2.length.should.eql(3);
            should.exist(historyReadResult2.continuationPoint, "expecting a continuation point in our case");

            const continuationPoint2 = historyReadResult2.continuationPoint;
            should(continuationPoint2).not.eql(null);
            should(continuationPoint2).eql(continuationPoint);

            dataValues2[0].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 3 }).getTime());
            dataValues2[1].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 4 }).getTime());
            dataValues2[2].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 5 }).getTime());

            // make_second_continuation_read(callback) {
            const historyReadResponse3 = await session.historyRead(
                new HistoryReadRequest({
                    nodesToRead: [
                        { nodeId, indexRange, dataEncoding, continuationPoint },
                    ],
                    historyReadDetails,
                    releaseContinuationPoints: false,
                    timestampsToReturn: TimestampsToReturn.Both
                })
            );
            const historyReadResult3 = historyReadResponse3.results![0];
            historyReadResult3.statusCode.should.eql(StatusCodes.Good);

            const dataValues3 = (historyReadResult3.historyData as HistoryData).dataValues!;
            dataValues3.length.should.eql(1);
            should.not.exist(historyReadResult3.continuationPoint, "expecting no continuation point");

            dataValues3[0].sourceTimestamp!.getTime().should.eql(date_add(today, { seconds: 6 }).getTime());

            //
            const historyReadResponse4 = await session.historyRead(
                new HistoryReadRequest({
                    nodesToRead: [{ nodeId, indexRange, dataEncoding, continuationPoint }],
                    historyReadDetails,
                    releaseContinuationPoints: false,
                    timestampsToReturn: TimestampsToReturn.Both
                })
            );
            const historyReadResult4 = historyReadResponse4.results![0];
            historyReadResult4.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });
    });

    async function sendHistoryReadWithContinuationPointReturnContinuationPoint(
        session: ClientSession,
        cntPoint: ContinuationPoint | undefined,
        releaseContinuationPoints = false
    ): Promise<{
        continuationPoint: ContinuationPoint;
        statusCode: StatusCode;
        dataValues: DataValue[];
    }> {
        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 1000 }),
            isReadModified: false,
            numValuesPerNode: 3, // three at a time
            returnBounds: false,
            startTime: date_add(today, { seconds: -10 })
        });
        const indexRange = undefined;
        const dataEncoding = undefined;

        const readRequest = new HistoryReadRequest({
            nodesToRead: [
                { nodeId, indexRange, dataEncoding, continuationPoint: cntPoint }
            ],
            historyReadDetails,
            releaseContinuationPoints,
            timestampsToReturn: TimestampsToReturn.Both
        });
        const historyReadResponse = await session.historyRead(readRequest);
        const historyReadResult = historyReadResponse.results![0];
        const statusCode = historyReadResult.statusCode;
        const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;

        const continuationPoint = historyReadResult.continuationPoint;
        return { continuationPoint, statusCode, dataValues };
    }
    it("should readHistory with continuation point -  and release continuation points if releaseContinuationPoints= true", async () => {
        const endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            // given that the client has sent a historyRead request that generated a continuation point with releaseContinuationPoints=true
            const cont1 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, undefined, true);
            should.not.exist(cont1.continuationPoint);
        });
    });
    it("should readHistory with continuation point - server should not server continuation point that have been released", async () => {
        const endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            // given that the client has sent a historyRead request that generated a continuation point with releaseContinuationPoints=false
            const cont1 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, undefined, false);
            should.exist(cont1.continuationPoint);
            cont1.statusCode.should.eql(StatusCodes.Good);
         
            // when that the client has sent a historyRead request that generated a continuation point with releaseContinuationPoints=true
            const cont2 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, cont1.continuationPoint, true);
            should.not.exist(cont2.continuationPoint);
            cont2.statusCode.should.eql(StatusCodes.Good);

            // then the server should serve the continuation point anymore
            const cont3 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, cont1.continuationPoint, true);
            should.not.exist(cont3.continuationPoint);
            cont3.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);

        });
    });

    it("the server shall automatically free ContinuationPoints from prior requests from a Session if they are needed to process a new request from this Session.", async () => {
        const endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            // given that the client has sent a first historyRead request that generated a continuation point
            const cont1 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, undefined);
            cont1.statusCode.should.eql(StatusCodes.Good);

            // and given that the client send a second historyRead request again
            const cont2 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, undefined);
            cont2.statusCode.should.eql(StatusCodes.Good);

            // when the client try to read again with the continuation point of the first request
            const cont3 = await sendHistoryReadWithContinuationPointReturnContinuationPoint(session, cont1.continuationPoint);
            // then the server shall return with BadContinuationPointInvalid
            cont3.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });
    });
});
