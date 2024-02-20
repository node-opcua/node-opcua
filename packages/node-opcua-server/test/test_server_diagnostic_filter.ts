import should from "should";
import { CallResponse } from "node-opcua-service-call";
import { DiagnosticInfo, DiagnosticInfo_OperationLevelMask, DiagnosticInfo_ServiceLevelMask } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { filterDiagnosticInfo } from "../source";

describe("filterDiagnosticInfo", function () {
    let response: CallResponse;

    beforeEach(function () {
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

    it("should filter diagnostic information", function () {
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

        response.responseHeader.serviceDiagnostics!.localizedText.should.equal(2345);
        response.responseHeader.serviceDiagnostics!.symbolicId.should.equal(3456);
        should(response.responseHeader.serviceDiagnostics!.additionalInfo).equal(null);
        response.responseHeader.serviceDiagnostics!.innerStatusCode.should.equal(StatusCodes.Bad);

        should(response.responseHeader.serviceDiagnostics!.innerDiagnosticInfo).not.equal(null);
        response.responseHeader.serviceDiagnostics!.innerDiagnosticInfo!.additionalInfo!.should.equal("test 2");

        for (const entry of response.results || []) {
            for (const diag of entry.inputArgumentDiagnosticInfos! || []) {
                diag!.additionalInfo!.should.equal("input argument");
                diag!.symbolicId.should.equal(34567);
                diag!.innerStatusCode.should.equal(StatusCodes.Bad);
            }
        }

        for (const diag of response.diagnosticInfos || []) {
            diag!.additionalInfo!.should.equal("diagnostic infos");
            diag!.symbolicId.should.equal(34567);
            diag!.innerStatusCode.should.equal(StatusCodes.Bad);
        }
    });
});
