import { DiagnosticInfo, DiagnosticInfo_OperationLevelMask, DiagnosticInfo_ServiceLevelMask } from "node-opcua-data-model";
import { CallResponse } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { filterDiagnosticInfo } from "../source/index.js";

describe("filterDiagnosticInfo", () => {
    let response: CallResponse;

    beforeEach(() => {
        response = new CallResponse({
            responseHeader: {
                serviceDiagnostics: new DiagnosticInfo({
                    localizedText: 2345,
                    symbolicId: 3456,
                    additionalInfo: "test",
                    innerStatusCode: StatusCodes.Bad,
                    innerDiagnosticInfo: new DiagnosticInfo({
                        additionalInfo: "test 2",
                        innerStatusCode: StatusCodes.Bad,
                        symbolicId: 34567
                    })
                })
            },
            results: [
                {
                    inputArgumentDiagnosticInfos: [
                        new DiagnosticInfo({
                            additionalInfo: "input argument",
                            innerStatusCode: StatusCodes.Bad,
                            symbolicId: 34567
                        })
                    ]
                }
            ],
            diagnosticInfos: [
                new DiagnosticInfo({ additionalInfo: "diagnostic infos", innerStatusCode: StatusCodes.Bad, symbolicId: 34567 })
            ]
        });
    });

    it("should filter diagnostic information", () => {
        const levelMask =
            DiagnosticInfo_ServiceLevelMask.SymbolicId |
            DiagnosticInfo_ServiceLevelMask.LocalizedText |
            DiagnosticInfo_ServiceLevelMask.InnerStatusCode |
            DiagnosticInfo_ServiceLevelMask.InnerDiagnostics |
            DiagnosticInfo_OperationLevelMask.SymbolicId |
            DiagnosticInfo_OperationLevelMask.LocalizedText |
            DiagnosticInfo_OperationLevelMask.InnerStatusCode |
            DiagnosticInfo_OperationLevelMask.AdditionalInfo |
            DiagnosticInfo_OperationLevelMask.InnerDiagnostics;
        filterDiagnosticInfo(levelMask, response);

        should(response.responseHeader.serviceDiagnostics?.localizedText).equal(2345);
        should(response.responseHeader.serviceDiagnostics?.symbolicId).equal(3456);
        should(response.responseHeader.serviceDiagnostics?.additionalInfo).equal(null);
        should(response.responseHeader.serviceDiagnostics?.innerStatusCode).equal(StatusCodes.Bad);

        should(response.responseHeader.serviceDiagnostics?.innerDiagnosticInfo).not.equal(null);
        should(response.responseHeader.serviceDiagnostics?.innerDiagnosticInfo?.additionalInfo).equal("test 2");

        for (const entry of response.results || []) {
            for (const diag of entry.inputArgumentDiagnosticInfos! || []) {
                should(diag?.additionalInfo).equal("input argument");
                should(diag?.symbolicId).equal(34567);
                should(diag?.innerStatusCode).equal(StatusCodes.Bad);
            }
        }

        for (const diag of response.diagnosticInfos || []) {
            should(diag?.additionalInfo).equal("diagnostic infos");
            should(diag?.symbolicId).equal(34567);
            should(diag?.innerStatusCode).equal(StatusCodes.Bad);
        }
    });
});
