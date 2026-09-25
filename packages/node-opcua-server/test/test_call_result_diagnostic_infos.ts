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

    it("puts statusText in the string table and points localizedText at it when LocalizedText (0x40) is asked for", () => {
        const stringTable: string[] = [];
        const withText = { statusCode: StatusCodes.BadRequestNotAllowed, statusText: "rejected by the approver: unknown device" };
        const infos = callResultDiagnosticInfos(0x40, [plain, withText, withText], stringTable);
        should(stringTable).eql(["rejected by the approver: unknown device"]);
        should(infos.map((d) => d.localizedText >= 0)).eql([false, true, true]);
        should(infos[1].localizedText).eql(0);
        should(infos[2].localizedText).eql(0);
    });

    it("leaves the string table alone when LocalizedText is not asked for", () => {
        const stringTable: string[] = [];
        const withText = { statusCode: StatusCodes.BadRequestNotAllowed, statusText: "nope" };
        should(callResultDiagnosticInfos(OPERATION_ADDITIONAL_INFO, [withText], stringTable)).eql([]);
        should(stringTable).eql([]);
    });

    it("caps statusText at 256 bytes of UTF-8 without splitting a character (§7.12)", () => {
        const stringTable: string[] = [];
        callResultDiagnosticInfos(0x40, [{ statusCode: StatusCodes.Bad, statusText: "é".repeat(200) }], stringTable);
        should(Buffer.byteLength(stringTable[0], "utf8")).eql(256);
        should(stringTable[0]).eql("é".repeat(128));
    });

    it("describes a non-Good result the method said nothing about, from its StatusCode", () => {
        const stringTable: string[] = [];
        const infos = callResultDiagnosticInfos(0x20 | 0x40, [plain, { statusCode: StatusCodes.BadInvalidState }], stringTable);
        should(infos.length).eql(2);
        should(infos[0].symbolicId >= 0).eql(false);
        should(stringTable[infos[1].symbolicId]).eql("BadInvalidState");
        should(stringTable[infos[1].namespaceURI]).eql("http://opcfoundation.org/UA/");
        should(stringTable[infos[1].localizedText]).eql(StatusCodes.BadInvalidState.description);
    });

    it("keeps a field the method already set", () => {
        const stringTable: string[] = ["already there"];
        const infos = callResultDiagnosticInfos(
            0x40,
            [{ statusCode: StatusCodes.BadInvalidState, diagnosticInfo: { localizedText: 0 } }],
            stringTable
        );
        should(infos[0].localizedText).eql(0);
        should(stringTable).eql(["already there"]);
    });

    it("adds the locale of statusText to the string table", () => {
        const stringTable: string[] = [];
        const infos = callResultDiagnosticInfos(
            0x40,
            [{ statusCode: StatusCodes.BadRequestNotAllowed, statusText: { text: "refusé", locale: "fr-FR" } }],
            stringTable
        );
        should(stringTable[infos[0].localizedText]).eql("refusé");
        should(stringTable[infos[0].locale]).eql("fr-FR");
    });

    it("returns nothing when no method provided one", () => {
        should(callResultDiagnosticInfos(OPERATION_ADDITIONAL_INFO, [plain, plain])).eql([]);
    });
});
