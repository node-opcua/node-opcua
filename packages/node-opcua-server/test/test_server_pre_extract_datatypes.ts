/**
 * The Call and Write services build the address space's ExtraDataTypeManager lazily, the first
 * time one of them is served. That walk browses through a PseudoSession, which defers every
 * batch by one `setImmediate`, so it costs a few hundred event loop turns. On an idle server
 * those turns are free; on a server that is sampling thousands of monitored items a turn costs
 * tens of milliseconds and the first Call answers 20 to 60 s late - which is how CTT
 * "Base Info ResendData Method 001" timed out, in the extraction rather than in ResendData.
 *
 * The server therefore pays for the extraction while it starts, before any client can connect.
 * These tests count event loop turns rather than milliseconds: the number of turns is what a
 * loaded event loop multiplies, and it does not vary with the machine. Each one needs a server
 * that has never served a Call, so each one starts its own.
 */
import { ensureDatatypeExtracted } from "node-opcua-address-space";
import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../dist/index.js";

const portDirect = 5802;
const portCall = 5803;

// a walk of the address space costs hundreds of turns; anything done in a handful of turns
// did no walking at all
const NO_WALK = 20;

async function countLoopTurns<T>(action: () => Promise<T>): Promise<{ turns: number; result: T }> {
    let turns = 0;
    let running = true;
    const hop = () => {
        if (!running) {
            return;
        }
        turns += 1;
        setImmediate(hop);
    };
    setImmediate(hop);
    try {
        const result = await action();
        return { turns, result };
    } finally {
        running = false;
    }
}

async function withStartedServer(port: number, action: (server: OPCUAServer) => Promise<void>): Promise<void> {
    const server = new OPCUAServer({ port, nodeset_filename: [nodesets.standard] });
    await server.initialize();
    // a namespace registered by the application - as a server that publishes its own model does -
    // has no data type factory yet, so the extraction has real work to do. This is the shape of
    // the server under CTT test.
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("no address space");
    }
    addressSpace.registerNamespace("urn:test:pre-extract");
    await server.start();
    try {
        await action(server);
    } finally {
        await server.shutdown();
    }
}

describe("OPCUAServer extracts the address space data types before it starts listening", function (this: Mocha.Suite) {
    this.timeout(120000);

    it("has nothing left to extract once start() has returned", async () => {
        await withStartedServer(portDirect, async (server) => {
            const addressSpace = server.engine.addressSpace;
            if (!addressSpace) {
                throw new Error("no address space");
            }
            const { turns } = await countLoopTurns(async () => {
                await ensureDatatypeExtracted(addressSpace);
            });
            should(turns).be.lessThan(NO_WALK);
        });
    });

    it("answers the first Call of a session without walking the address space", async () => {
        await withStartedServer(portCall, async () => {
            const client = OPCUAClient.create({ endpointMustExist: false });
            await client.connect(`opc.tcp://localhost:${portCall}`);
            let session: ClientSession | undefined;
            try {
                session = await client.createSession();
                const theSession = session;
                const { turns, result } = await countLoopTurns(
                    async () =>
                        await theSession.call({
                            objectId: resolveNodeId("i=2253"),
                            methodId: resolveNodeId("i=11492"), // Server_GetMonitoredItems
                            inputArguments: [{ dataType: DataType.UInt32, value: 999999 }]
                        })
                );
                should(result.statusCode).eql(StatusCodes.BadSubscriptionIdInvalid);
                should(turns).be.lessThan(NO_WALK);
            } finally {
                await session?.close();
                await client.disconnect();
            }
        });
    });
});
