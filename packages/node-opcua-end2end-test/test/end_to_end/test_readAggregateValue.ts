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
} from "node-opcua";
import { addAggregateSupport  } from "node-opcua-aggregates";
import {
    createHistorian1,
    createHistorian2,
    createHistorian3,
    createHistorian4
} from "node-opcua-aggregates/test/helpers/create_historizing_variables";
import { ClientSessionKeepAliveManagerEvents } from "node-opcua-client/dist/client_session_keepalive_manager";

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
        port,
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
        console.log("endpointUrl = ", endpointUrl);
    });
    after(async () => {
        await server.shutdown();
    });

    it("RHA should calculate average", async () => {

        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const parameters = {};
        await client.withSubscriptionAsync(endpointUrl, parameters, async (session: ClientSession, subscription: ClientSubscription) => {

            const nodeToRead: ReadValueIdOptions = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const resultMax = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Maximum,
                processingInterval);

            resultMax.statusCode.should.eql(StatusCodes.Good);

            const resultMin = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Minimum,
                processingInterval);
            resultMin.statusCode.should.eql(StatusCodes.Good);

            const resultAvg = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.Average,
                processingInterval);
            resultAvg.statusCode.should.eql(StatusCodes.Good);
            // tslint:disable-next-line: no-console
            console.log(resultAvg.toString());

            const resultStdSample = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                AggregateFunction.StandardDeviationSample,
                processingInterval);
            resultStdSample.statusCode.should.eql(StatusCodes.BadAggregateNotSupported);

        });
    });

    it("RHA should calculate aggregate(multi) of multiple nodeId", async () => {

        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const parameters = {};
        await client.withSubscriptionAsync(endpointUrl, parameters, async (session: ClientSession, subscription: ClientSubscription) => {

            const nodeToRead: ReadValueIdOptions[] = [{ nodeId: h1NodeId },{ nodeId: h1NodeId }];
            const aggregateFn = [AggregateFunction.Maximum, AggregateFunction.Minimum];

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const processingInterval = 16 * 1000;
            const resultMaxMin = await session.readAggregateValue(
                nodeToRead,
                startTime,
                endTime,
                aggregateFn,
                processingInterval);

            resultMaxMin[0].statusCode.should.eql(StatusCodes.Good);
            resultMaxMin[1].statusCode.should.eql(StatusCodes.Good);

        });
    });


    it("RHV readHistoryValue - form 1", async () =>{
        const client = OPCUAClient.create({
            endpointMustExist: false
        });


        await client.withSubscriptionAsync(endpointUrl, {}, async (session: ClientSession) => {

            const nodeToRead: HistoryReadValueIdOptions2 = { nodeId: h1NodeId };

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const result = await session.readHistoryValue(
                nodeToRead, // use a HistoryReadValueIdOptions2 here
                startTime,
                endTime);
            // tslint:disable-next-line: no-console
            console.log(result.toString());
        });
    });

    it("RHV readHistoryValue - form 2", async () =>{
        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        await client.withSubscriptionAsync(endpointUrl, {}, async (session: ClientSession) => {

            const startTime = makeDate("12:00:00");
            const endTime = makeDate("12:01:40");

            const result = await session.readHistoryValue(
                h1NodeId, // use  a nodeId here
                startTime,
                endTime);
            // tslint:disable-next-line: no-console
            console.log(result.toString());
        }); 
    });

});
