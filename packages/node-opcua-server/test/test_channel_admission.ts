import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../dist/index.js";

const port = 5829;

/**
 * A channel starts a request only while the responses already on their way leave room
 * (ServerSecureChannelLayer, CHANNEL_RESPONSE_BUDGET of 16 MB): a client pipelining reads of
 * large values gets them a few at a time, instead of the server building them all at once.
 */
describe("a secure channel starts requests as fast as their responses leave", function () {
    this.timeout(120_000);
    let server: OPCUAServer;
    let client: OPCUAClient;
    let session: ClientSession;
    let inProgress = 0;
    let maxInProgress = 0;

    /** a value answered 20 ms after it is asked: the reads of a pipeline overlap in the server */
    function slowValue(make: () => Variant) {
        return {
            refreshFunc(callback: (err: Error | null, dataValue?: DataValue) => void) {
                inProgress++;
                maxInProgress = Math.max(maxInProgress, inProgress);
                setTimeout(() => {
                    inProgress--;
                    callback(null, new DataValue({ value: make(), sourceTimestamp: new Date() }));
                }, 20);
            }
        };
    }

    before(async () => {
        server = new OPCUAServer({ port, nodeset_filename: [nodesets.standard] });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const big = new Int32Array(1024 * 1024); // 4 MB
        for (let i = 0; i < 16; i++) {
            namespace.addVariable({
                nodeId: `s=Big${i}`,
                browseName: `Big${i}`,
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "Int32",
                valueRank: 1,
                value: slowValue(() => new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: big }))
            });
        }
        for (let i = 0; i < 32; i++) {
            namespace.addVariable({
                nodeId: `s=Small${i}`,
                browseName: `Small${i}`,
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "Int32",
                value: slowValue(() => new Variant({ dataType: DataType.Int32, value: i }))
            });
        }
        await server.start();
        client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(`opc.tcp://localhost:${port}`);
        session = await client.createSession();
    });
    after(async () => {
        await session?.close();
        await client?.disconnect();
        await server?.shutdown();
    });

    function readAll(prefix: string, count: number) {
        const ns = server.engine.addressSpace!.getOwnNamespace().index;
        return Promise.all(
            Array.from({ length: count }, (_, i) =>
                session.read({ nodeId: `ns=${ns};s=${prefix}${i}`, attributeId: AttributeIds.Value })
            )
        );
    }

    it("builds the responses of 16 pipelined 4 MB reads no more than 4 at a time", async () => {
        maxInProgress = 0;
        const values = await readAll("Big", 16);
        for (const value of values) {
            should(value.statusCode).eql(StatusCodes.Good);
            should(value.value.value.length).eql(1024 * 1024);
        }
        should(maxInProgress).be.belowOrEqual(4);
        should(maxInProgress).be.aboveOrEqual(1);
    });

    it("lets the pipelined reads of small values run together", async () => {
        // the size of the Read responses is known by now: they are large; a few small ones first
        await readAll("Small", 8);
        await readAll("Small", 8);
        maxInProgress = 0;
        const values = await readAll("Small", 32);
        for (const value of values) should(value.statusCode).eql(StatusCodes.Good);
        should(maxInProgress).be.above(4);
    });
});
