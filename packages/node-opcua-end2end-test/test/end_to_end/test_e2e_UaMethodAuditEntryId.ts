import os from "node:os";
import {
    CallRequest,
    type CallResponse,
    type ClientSession,
    DataType,
    type ISessionContext,
    OPCUAClient,
    OPCUAServer,
    RequestHeader,
    StatusCodes,
    type Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";

// performMessageTransaction is public on the session implementation but not exposed on the
// public ClientSession interface; reached here so a test can attach a known
// RequestHeader.AuditEntryId to a CallRequest, which a normal ClientSession#call() never lets
// the caller set.
interface SessionWithTransaction {
    performMessageTransaction(request: CallRequest): Promise<CallResponse>;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// OPC 10000-4 v1.05.07 §7.32 RequestHeader.auditEntryId / OPC 10000-5 v1.05.06 §6.4.3
// AuditEventType.ClientAuditEntryId: a Method handler that raises an audit event needs the
// RequestHeader of the Call that invoked it, not just the Session's identity, so it can copy
// auditEntryId into the Event's ClientAuditEntryId.
describe("a Method handler sees the RequestHeader of the Call that invoked it", () => {
    const port = 5816;
    const server = new OPCUAServer({ port });

    const client = OPCUAClient.create({ endpointMustExist: false });
    let clientSession: ClientSession;

    before(async () => {
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(addressSpace.rootFolder.objects, {
            browseName: "auditEntryId",
            nodeId: "ns=1;s=auditEntryId"
        });

        // returns what it sees as the Call's auditEntryId, read once synchronously on entry
        namespace
            .addMethod(folder, {
                browseName: "EchoAuditEntryId",
                nodeId: "ns=1;s=EchoAuditEntryId",
                outputArguments: [{ name: "auditEntryId", dataType: DataType.String }]
            })
            .bindMethod(async (_inputArguments: Variant[], context: ISessionContext) => {
                return {
                    statusCode: StatusCodes.Good,
                    outputArguments: [{ dataType: DataType.String, value: context.getAuditEntryId() ?? "" }]
                };
            });

        // same, but reads the id again after an async delay - proves the value seen while the
        // handler was suspended still belongs to *this* Call, not to another one that ran on the
        // same Session while this one was waiting.
        namespace
            .addMethod(folder, {
                browseName: "EchoAuditEntryIdSlow",
                nodeId: "ns=1;s=EchoAuditEntryIdSlow",
                outputArguments: [
                    { name: "auditEntryIdBeforeDelay", dataType: DataType.String },
                    { name: "auditEntryIdAfterDelay", dataType: DataType.String }
                ]
            })
            .bindMethod(async (_inputArguments: Variant[], context: ISessionContext) => {
                const before = context.getAuditEntryId() ?? "";
                await sleep(300);
                const after = context.getAuditEntryId() ?? "";
                return {
                    statusCode: StatusCodes.Good,
                    outputArguments: [
                        { dataType: DataType.String, value: before },
                        { dataType: DataType.String, value: after }
                    ]
                };
            });

        await server.start();
        await client.connect(`opc.tcp://${os.hostname()}:${port}/UA/NodeOPCUA`);
        clientSession = await client.createSession();
    });

    after(async () => {
        await clientSession.close();
        await client.disconnect();
        await server.shutdown();
    });

    async function callWithAuditEntryId(methodId: string, auditEntryId: string | undefined): Promise<CallResponse> {
        const request = new CallRequest({
            methodsToCall: [{ objectId: "ns=1;s=auditEntryId", methodId, inputArguments: [] }],
            requestHeader: new RequestHeader({ auditEntryId })
        });
        return (clientSession as unknown as SessionWithTransaction).performMessageTransaction(request);
    }

    it("reports an empty auditEntryId when the CallRequest carries none", async () => {
        const response = await callWithAuditEntryId("ns=1;s=EchoAuditEntryId", undefined);
        should.exist(response.results);
        const result = response.results![0];
        should(result.statusCode.isGood()).eql(true);
        should(result.outputArguments?.[0]?.value).eql("");
    });

    it("reports the CallRequest's own RequestHeader.auditEntryId", async () => {
        const response = await callWithAuditEntryId("ns=1;s=EchoAuditEntryId", "single-call-entry");
        should.exist(response.results);
        const result = response.results![0];
        should(result.statusCode.isGood()).eql(true);
        should(result.outputArguments?.[0]?.value).eql("single-call-entry");
    });

    // the race this guards against: session.sessionContext is one instance shared by every
    // request in flight on the Session. Two CallRequests sent without waiting for one another
    // exercise that concurrency directly; each must see only its own auditEntryId, both before
    // and after the in-handler delay.
    it("two concurrent Calls on the same Session each see their own auditEntryId, never the other's", async () => {
        const [response1, response2] = await Promise.all([
            callWithAuditEntryId("ns=1;s=EchoAuditEntryIdSlow", "concurrent-entry-1"),
            callWithAuditEntryId("ns=1;s=EchoAuditEntryIdSlow", "concurrent-entry-2")
        ]);
        should.exist(response1.results);
        should.exist(response2.results);
        const result1 = response1.results![0];
        const result2 = response2.results![0];

        should(result1.statusCode.isGood()).eql(true);
        should(result2.statusCode.isGood()).eql(true);

        should(result1.outputArguments?.[0]?.value).eql("concurrent-entry-1");
        should(result1.outputArguments?.[1]?.value).eql("concurrent-entry-1");

        should(result2.outputArguments?.[0]?.value).eql("concurrent-entry-2");
        should(result2.outputArguments?.[1]?.value).eql("concurrent-entry-2");
    });
});
