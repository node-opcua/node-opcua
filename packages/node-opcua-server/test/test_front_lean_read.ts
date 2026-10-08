import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { type ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { ReadRequest, type ReadResponse, type ReadValueIdOptions, WriteRequest } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { leanRead } from "../dist/front_threads/lean_read.js";

type LeanReadArgs = Parameters<typeof leanRead>;

/** the body of a MSG carrying `request`, and the offset of its fields (after its type id) */
function bodyOf(request: ReadRequest | WriteRequest): { body: Buffer; offset: number } {
    const stream = new BinaryStream(Buffer.alloc(64 * 1024));
    encodeExpandedNodeId(request.schema.encodingDefaultBinary as ExpandedNodeId, stream);
    const offset = stream.length;
    request.encode(stream);
    return { body: Buffer.from(stream.buffer.subarray(0, stream.length)), offset };
}

describe("leanRead: a Read of items served in place, answered from the bytes of the request", () => {
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
            backend: {
                inPlaceIndex: (item: ReadValueIdOptions) => store.get((item.nodeId as NodeId).toString()) ?? -1,
                readAt: (i: number, _context: unknown, maxAge: number, timestampsToReturn: number) => {
                    readAtCalls.push({ i, maxAge, timestampsToReturn });
                    return new DataValue({ value: { dataType: DataType.Int32, value: i } });
                }
            }
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
