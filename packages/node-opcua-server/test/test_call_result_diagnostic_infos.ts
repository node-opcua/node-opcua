// OPC 10000-4 v1.05.07 §5.12.2 Call: CallResponse.diagnosticInfos is the "List of diagnostic information for the
// statusCode of the results", returned when the Client asks through RequestHeader.returnDiagnostics (§7.33).
import { DiagnosticInfo } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { callResultDiagnosticInfos } from "../source/opcua_server.js";

const OPERATION_ADDITIONAL_INFO = 0x80;
const SERVICE_ADDITIONAL_INFO = 0x04;

describe("callResultDiagnosticInfos", () => {
    const refused = { statusCode: StatusCodes.BadRequestNotAllowed, diagnosticInfo: { additionalInfo: "not in the inventory" } };
    const plain = { statusCode: StatusCodes.Good, outputArguments: [] };

    it("returns one DiagnosticInfo per result, in order, when operation-level diagnostics are asked for", () => {
        const infos = callResultDiagnosticInfos(OPERATION_ADDITIONAL_INFO, [plain, refused]);
        should(infos.length).eql(2);
        should(infos[0]).be.instanceOf(DiagnosticInfo);
        should(infos[0].additionalInfo).eql(null);
        should(infos[1].additionalInfo).eql("not in the inventory");
    });

    it("returns nothing when the client did not ask", () => {
        should(callResultDiagnosticInfos(0, [refused])).eql([]);
    });

    it("returns nothing when the client asked for service-level diagnostics only", () => {
        should(callResultDiagnosticInfos(SERVICE_ADDITIONAL_INFO, [refused])).eql([]);
    });

    it("returns nothing when no method provided one", () => {
        should(callResultDiagnosticInfos(OPERATION_ADDITIONAL_INFO, [plain, plain])).eql([]);
    });
});
