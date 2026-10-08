import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { type ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { ReadRequest, type ReadResponse, type ReadValueIdOptions, WriteRequest, type WriteResponse } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { leanRead } from "../dist/lean_read.js";
import { leanWrite } from "../dist/lean_write.js";

type LeanReadArgs = Parameters<typeof leanRead>;

/** the body of a MSG carrying `request`, and the offset of its fields (after its type id) */
function bodyOf(request: ReadRequest | WriteRequest): { body: Buffer; offset: number } {
    const stream = new BinaryStream(Buffer.alloc(64 * 1024));
    encodeExpandedNodeId(request.schema.encodingDefaultBinary as ExpandedNodeId, stream);
    const offset = stream.length;
    request.encode(stream);
    return { body: Buffer.from(stream.buffer.subarray(0, stream.length)), offset };
}

describe("leanRead: a Read of Values answered from the bytes of the request", () => {
    const token = new NodeId(NodeIdType.BYTESTRING, Buffer.alloc(32, 7), 1);
    const store = new Map<string, number>([
        ["ns=2;i=1001", 11],
        ["ns=2;i=1002", 12]
    ]);

    function setup(options: { status?: string; otherChannel?: boolean; noSession?: boolean; maxNodesPerRead?: number } = {}) {
        const sent: {
            response: ReadResponse;
            message: { requestId: number; request: { requestHeader: { requestHandle: number } } };
        }[] = [];
        const channel = {
            channelId: 5,
            send_response: (_msgType: string, response: ReadResponse, message: (typeof sent)[number]["message"]) => {
                sent.push({ response, message });
            }
        };
        const counters = { keepAlive: 0, total: 0, read: [] as string[] };
        const session = {
            status: options.status ?? "active",
            channel: options.otherChannel ? {} : channel,
            channelId: options.otherChannel ? 6 : 5,
            sessionContext: { tag: "context" },
            keepAlive: () => counters.keepAlive++,
            incrementTotalRequestCount: () => counters.total++,
            incrementRequestTotalCounter: (name: string) => counters.read.push(name)
        };
        const readAtCalls: { i: number; maxAge: number; timestampsToReturn: number }[] = [];
        const host = {
            getSession: (authenticationToken: NodeId) =>
                !options.noSession && authenticationToken.toString() === token.toString() ? session : null,
            maxNodesPerRead: options.maxNodesPerRead ?? 0,
            itemOf: (nodeId: NodeId) => store.get(nodeId.toString()) ?? null,
            read: (_context: unknown, items: number[], maxAge: number, timestampsToReturn: number) =>
                items.map((i) => {
                    readAtCalls.push({ i, maxAge, timestampsToReturn });
                    return new DataValue({ value: { dataType: DataType.Int32, value: i } });
                })
        };
        const run = (request: ReadRequest | WriteRequest) => {
            const { body, offset } = bodyOf(request);
            return leanRead(
                host as unknown as LeanReadArgs[0],
                channel as unknown as LeanReadArgs[1],
                request.schema.encodingDefaultBinary?.value as number,
                body,
                offset,
                42,
                {} as LeanReadArgs[6]
            );
        };
        return { run, sent, counters, readAtCalls };
    }

    const read = (nodesToRead: ReadValueIdOptions[], more: Partial<ConstructorParameters<typeof ReadRequest>[0]> = {}) =>
        new ReadRequest({
            requestHeader: { authenticationToken: token, requestHandle: 1234, auditEntryId: "audit entry", timeoutHint: 5000 },
            maxAge: 100,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead,
            ...more
        });
    const value = (nodeId: string): ReadValueIdOptions => ({ nodeId, attributeId: AttributeIds.Value });

    it("answers the items from the store, with the request's handle, maxAge and timestamps, and counts it", () => {
        const { run, sent, counters, readAtCalls } = setup();
        should(run(read([value("ns=2;i=1001"), value("ns=2;i=1002")]))).eql(true);
        should(sent.length).eql(1);
        should(sent[0].response.results?.map((d) => d.value.value)).eql([11, 12]);
        should(sent[0].message.requestId).eql(42);
        should(sent[0].message.request.requestHeader.requestHandle).eql(1234);
        should(readAtCalls).eql([
            { i: 11, maxAge: 100, timestampsToReturn: TimestampsToReturn.Both },
            { i: 12, maxAge: 100, timestampsToReturn: TimestampsToReturn.Both }
        ]);
        should(counters).eql({ keepAlive: 1, total: 1, read: ["Read"] });
    });

    const fallbacks: [string, () => ReadRequest | WriteRequest, Parameters<typeof setup>[0]?][] = [
        ["another service", () => new WriteRequest({ requestHeader: { authenticationToken: token } })],
        ["another attribute", () => read([{ nodeId: "ns=2;i=1001", attributeId: AttributeIds.BrowseName }])],
        ["an index range", () => read([{ ...value("ns=2;i=1001"), indexRange: new NumericRange("1:2") }])],
        ["a data encoding", () => read([{ ...value("ns=2;i=1001"), dataEncoding: { namespaceIndex: 0, name: "Default Binary" } }])],
        ["a node the store does not serve", () => read([value("ns=2;i=1001"), value("ns=2;i=9999")])],
        ["no items", () => read([])],
        ["a negative maxAge", () => read([value("ns=2;i=1001")], { maxAge: -1 })],
        ["invalid timestampsToReturn", () => read([value("ns=2;i=1001")], { timestampsToReturn: TimestampsToReturn.Invalid })],
        ["more items than maxNodesPerRead", () => read([value("ns=2;i=1001"), value("ns=2;i=1002")]), { maxNodesPerRead: 1 }],
        ["an unknown session", () => read([value("ns=2;i=1001")]), { noSession: true }],
        ["a session not activated", () => read([value("ns=2;i=1001")]), { status: "new" }],
        ["a session of another channel", () => read([value("ns=2;i=1001")]), { otherChannel: true }]
    ];
    for (const [what, request, options] of fallbacks) {
        it(`leaves to the normal path, untouched, a request with ${what}`, () => {
            const { run, sent, counters } = setup(options);
            should(run(request())).eql(false);
            should(sent.length).eql(0);
            should(counters).eql({ keepAlive: 0, total: 0, read: [] });
        });
    }
});

describe("leanWrite: a Write answered from the bytes of the request", () => {
    const token = new NodeId(NodeIdType.BYTESTRING, Buffer.alloc(32, 9), 1);
    type LeanWriteArgs = Parameters<typeof leanWrite>;

    function setup(options: { registered?: boolean; maxNodesPerWrite?: number } = {}) {
        const sent: { response: WriteResponse }[] = [];
        const channel = { channelId: 5, send_response: (_msgType: string, response: WriteResponse) => sent.push({ response }) };
        const session = {
            status: "active",
            channel,
            channelId: 5,
            sessionContext: {},
            keepAlive: () => undefined,
            incrementTotalRequestCount: () => undefined,
            incrementRequestTotalCounter: () => undefined,
            incrementRequestErrorCounter: () => undefined,
            hasRegisteredNodes: () => options.registered === true
        };
        const written: { bytes: Uint8Array; count: number }[] = [];
        const settle: ((results: StatusCode[]) => void)[] = [];
        const host = {
            getSession: () => session,
            maxNodesPerWrite: options.maxNodesPerWrite ?? 0,
            write: (_context: unknown, bytes: Uint8Array, count: number) => {
                written.push({ bytes, count });
                return new Promise<StatusCode[]>((resolve) => settle.push(resolve));
            }
        };
        const run = (request: WriteRequest | ReadRequest) => {
            const { body, offset } = bodyOf(request);
            return leanWrite(
                host as unknown as LeanWriteArgs[0],
                channel as unknown as LeanWriteArgs[1],
                request.schema.encodingDefaultBinary?.value as number,
                body,
                offset,
                7,
                {} as LeanWriteArgs[6]
            );
        };
        return { run, sent, written, settle };
    }
    const writeRequest = (count: number) =>
        new WriteRequest({
            requestHeader: { authenticationToken: token, requestHandle: 9 },
            nodesToWrite: Array.from({ length: count }, (_, k) => ({
                nodeId: `ns=2;i=${1001 + k}`,
                attributeId: AttributeIds.Value,
                value: { value: { dataType: DataType.Double, value: k } }
            }))
        });

    it("hands the WriteValues as they were encoded to the host, and answers with its statuses", async () => {
        const { run, sent, written, settle } = setup();
        const request = writeRequest(2);
        should(run(request)).eql(true);
        should(written.length).eql(1);
        should(written[0].count).eql(2);
        // the bytes after the RequestHeader: the count, then the WriteValues
        const { body } = bodyOf(request);
        should(Buffer.from(written[0].bytes).equals(body.subarray(body.length - written[0].bytes.length))).eql(true);
        settle[0]([StatusCodes.Good, StatusCodes.BadNotWritable]);
        await new Promise((resolve) => setImmediate(resolve));
        should(sent.map((s) => s.response.results?.map((r) => r.name))).eql([["Good", "BadNotWritable"]]);
    });

    for (const [what, request, options] of [
        ["no items", () => writeRequest(0), {}],
        ["more items than maxNodesPerWrite", () => writeRequest(3), { maxNodesPerWrite: 2 }],
        ["a session with registered nodes", () => writeRequest(1), { registered: true }],
        ["another service", () => new ReadRequest({ requestHeader: { authenticationToken: token }, nodesToRead: [] }), {}]
    ] as [string, () => WriteRequest | ReadRequest, Parameters<typeof setup>[0]][]) {
        it(`leaves to the normal path a request with ${what}`, () => {
            const { run, written } = setup(options);
            should(run(request())).eql(false);
            should(written.length).eql(0);
        });
    }

    it("leaves to the normal path the Writes of a channel beyond 64 in progress", () => {
        const { run, written } = setup();
        for (let k = 0; k < 64; k++) should(run(writeRequest(1))).eql(true);
        should(run(writeRequest(1))).eql(false);
        should(written.length).eql(64);
    });
});
