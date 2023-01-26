import "should";
import * as should from "should";
import {
    OPCUAClient,
    OPCUAServer,
    NodeId,
    ClientSession,
    ReadValueIdOptions,
    StatusCodes,
    ClientSubscription,
    HistoryReadValueIdOptions2,
    AggregateFunction,
    HistoryReadResult,
    HistoryData
} from "node-opcua";

import { addAggregateSupport } from "node-opcua-aggregates";
import {
    createHistorian1,
    createHistorian2,
    createHistorian3,
    createHistorian4
} from "node-opcua-aggregates/test/helpers/create_historizing_variables";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const year = 2018;
const month = 10;
const day = 9;

export function makeDate(time: string): Date {
    const [hours, minutes, seconds] = time.split(":").map((x: string) => parseInt(x, 10));
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

let h1NodeId: NodeId;

const port = 2232;

async function startServerWithHA() {
    const server = new OPCUAServer({
        port
    });
    await server.initialize();

    const addressSpace = server.engine.addressSpace!;

    addAggregateSupport(addressSpace);
    const h1 = createHistorian1(addressSpace);
    const h2 = createHistorian2(addressSpace);
    const h3 = createHistorian3(addressSpace);
    const h4 = createHistorian4(addressSpace);

    h1NodeId = h1.nodeId;
    return server;
}
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("test readAggregateValue", () => {
    let server: OPCUAServer;
    let endpointUrl: string;
    before(async () => {
        server = await startServerWithHA();
        await server.start();
        endpointUrl = server.getEndpointUrl()!;
        // tslint:disable-next-line: no-console
        debugLog("endpointUrl = ", endpointUrl);
    });
    after(async () => {
        await server.shutdown();
    });

    it("RAV-1 readAggregateValue: should calculate average", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const resultMax = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Maximum,
                processingInterval
            );

            resultMax.statusCode.should.eql(StatusCodes.Good);

            const resultMin = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Minimum,
                processingInterval
            );
            resultMin.statusCode.should.eql(StatusCodes.Good);

            const resultAvg = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Average,
                processingInterval
            );
            resultAvg.statusCode.should.eql(StatusCodes.Good);
            // tslint:disable-next-line: no-console
            debugLog(resultAvg.toString());
        });
    });
    it("RAV-2 readAggregateValue: should return BadAggregateNotSupported if aggregatye function is not support", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });

        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");
            const processingInterval = 16 * 1000;

            const resultStdSample = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.StandardDeviationSample,
                processingInterval
            );
            resultStdSample.statusCode.should.eql(StatusCodes.BadAggregateNotSupported);
        });
    });

    it("RAV-3 readAggregateValue: should calculate aggregate(multi) of multiple nodeId", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });
        const historyReadResult = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions[] = [{ nodeId: h1NodeId }, { nodeId: h1NodeId }];
            const aggregateFn = [AggregateFunction.Maximum, AggregateFunction.Minimum];

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const resultMaxMin = await session.readAggregateValue(nodeToRead, startTime, endTime, aggregateFn, processingInterval);
            return resultMaxMin;
        });
        historyReadResult[0].statusCode.should.eql(StatusCodes.Good);
        historyReadResult[1].statusCode.should.eql(StatusCodes.Good);
    });

    it("RAV-4 readAggregateValue should return BadAggregateInvalidInputs if PercentDataBad and PercentDataGood are incoherent", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });
        const historyReadResult = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const historyReadResult = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Maximum,
                processingInterval,
                {
                    percentDataBad: 0, // << Invalid !
                    percentDataGood: 0, // << Invalid !
                    treatUncertainAsBad: true,
                    // useServerCapabilitiesDefaults: false,
                    useSlopedExtrapolation: true
                }
            );
            return historyReadResult;
        });

        historyReadResult.statusCode.should.eql(StatusCodes.BadAggregateInvalidInputs);
    });

    it("RAV-5 readAggregateValue should return Good if PercentDataBad and PercentDataGood are coherent", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const historyReadResult = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const historyReadResult = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Maximum,
                processingInterval,
                {
                    percentDataBad: 80, // << valid !
                    percentDataGood: 50, // << valid !
                    treatUncertainAsBad: true,
                    useServerCapabilitiesDefaults: false,
                    useSlopedExtrapolation: true
                }
            );
            return historyReadResult;
        });
        historyReadResult.statusCode.should.eql(StatusCodes.Good);
    });

    it("RAV-6 readAggregateValue with useServerCapabilitiesDefaults", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const historyReadResult = await client.withSessionAsync<HistoryReadResult>(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const historyReadResult = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Maximum,
                processingInterval,
                {
                    useServerCapabilitiesDefaults: true
                }
            );
            return historyReadResult;
        });
        should(historyReadResult.continuationPoint).eql(null);
        console.log(historyReadResult.toString());
        //  historyReadResult.historyData.length.should.eql(1);
        historyReadResult.statusCode.should.eql(StatusCodes.Good);
    });

    it("RHV-1 readHistoryValue - form 1", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const historyReadResult = await client.withSessionAsync<HistoryReadResult>(endpointUrl, async (session: ClientSession) => {
            const nodeToRead: HistoryReadValueIdOptions2 = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            return await session.readHistoryValue(
                nodeToRead, // use a HistoryReadValueIdOptions2 here
                startTime,
                endTime
            );
        });
        // tslint:disable-next-line: no-console
        debugLog(historyReadResult.toString());
    });

    it("RHV-2 readHistoryValue - form 2", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const historyReadResult = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            return await session.readHistoryValue(
                h1NodeId, // use  a nodeId here
                startTime,
                endTime
            );
        });
        // tslint:disable-next-line: no-console
        debugLog(historyReadResult.toString());
        historyReadResult.statusCode.should.eql(StatusCodes.Good);
        historyReadResult.historyData!.should.be.instanceOf(HistoryData);
        const historyData = historyReadResult.historyData! as HistoryData;
        historyData.dataValues!.length.should.eql(10);
    });
});
