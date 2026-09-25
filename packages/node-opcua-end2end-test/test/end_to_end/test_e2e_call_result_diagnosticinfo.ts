// OPC 10000-4 v1.05.07 §5.12.2 Call: a method can explain its result statusCode in CallResponse.diagnosticInfos,
// which the server returns only when the client asks through RequestHeader.returnDiagnostics (§7.33).
import os from "node:os";
import {
    type ClientSession,
    DataType,
    type ISessionContext,
    OPCUAClient,
    OPCUAServer,
    StatusCodes,
    type Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";

const OPERATION_LOCALIZED_TEXT = 0x40;
const OPERATION_ADDITIONAL_INFO = 0x80;
const REASON = "refused: device not in the inventory";

describe("Call: DiagnosticInfo for the result statusCode (OPC 10000-4 §5.12.2)", () => {
    const port = 2268;
    const server = new OPCUAServer({ port });
    const client = OPCUAClient.create({ endpointMustExist: false });
    let session: ClientSession;

    const refuse = { objectId: "ns=1;s=diag", methodId: "ns=1;s=Refuse", inputArguments: [] };
    const accept = { objectId: "ns=1;s=diag", methodId: "ns=1;s=Accept", inputArguments: [] };

    before(async () => {
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(addressSpace.rootFolder.objects, { browseName: "diag", nodeId: "ns=1;s=diag" });
        namespace
            .addMethod(folder, { browseName: "Refuse", nodeId: "ns=1;s=Refuse" })
            .bindMethod(async (_inputArguments: Variant[], _context: ISessionContext) => ({
                statusCode: StatusCodes.BadRequestNotAllowed,
                diagnosticInfo: { additionalInfo: REASON },
                statusText: REASON
            }));
        namespace
            .addMethod(folder, {
                browseName: "Accept",
                nodeId: "ns=1;s=Accept",
                outputArguments: [{ name: "ok", dataType: DataType.Boolean }]
            })
            .bindMethod(async (_inputArguments: Variant[], _context: ISessionContext) => ({
                statusCode: StatusCodes.Good,
                outputArguments: [{ dataType: DataType.Boolean, value: true }]
            }));
        await server.start();
        await client.connect(`opc.tcp://${os.hostname()}:${port}/UA/NodeOPCUA`);
        session = await client.createSession();
    });

    after(async () => {
        await session.close();
        await client.disconnect();
        await server.shutdown();
    });

    it("sends no DiagnosticInfo when the client does not ask", async () => {
        const { results, diagnosticInfos } = await session.callWithDiagnostics([refuse], 0);
        should(results[0].statusCode).eql(StatusCodes.BadRequestNotAllowed);
        should(diagnosticInfos).eql([]);
    });

    it("returns the method's text when the client asks for operation-level AdditionalInfo", async () => {
        const { results, diagnosticInfos } = await session.callWithDiagnostics([refuse], OPERATION_ADDITIONAL_INFO);
        should(results[0].statusCode).eql(StatusCodes.BadRequestNotAllowed);
        should(diagnosticInfos.length).eql(1);
        should(diagnosticInfos[0].additionalInfo).eql(REASON);
    });

    it("keeps one entry per result, in order, when only one method explains itself", async () => {
        const { results, diagnosticInfos } = await session.callWithDiagnostics([accept, refuse], OPERATION_ADDITIONAL_INFO);
        should(results.map((r) => r.statusCode)).eql([StatusCodes.Good, StatusCodes.BadRequestNotAllowed]);
        should(results[0].outputArguments?.[0].value).eql(true);
        should(diagnosticInfos.length).eql(2);
        should(diagnosticInfos[0].additionalInfo).eql(null);
        should(diagnosticInfos[1].additionalInfo).eql(REASON);
    });

    it("returns the text as LocalizedText, through the string table, to a client asking only for 0x40", async () => {
        const { results, diagnosticInfos, localizedTexts } = await session.callWithDiagnostics(
            [accept, refuse],
            OPERATION_LOCALIZED_TEXT
        );
        should(results[1].statusCode).eql(StatusCodes.BadRequestNotAllowed);
        should(diagnosticInfos.length).eql(2);
        should(localizedTexts).eql([null, REASON]);
        // AdditionalInfo was not asked for, so it is filtered out.
        should(diagnosticInfos[1].additionalInfo).eql(null);
    });

    it("sends no LocalizedText to a client asking only for AdditionalInfo", async () => {
        const { localizedTexts } = await session.callWithDiagnostics([refuse], OPERATION_ADDITIONAL_INFO);
        should(localizedTexts).eql([null]);
    });

    it("leaves the plain call() unchanged", async () => {
        const result = await session.call(refuse);
        should(result.statusCode).eql(StatusCodes.BadRequestNotAllowed);
    });
});
