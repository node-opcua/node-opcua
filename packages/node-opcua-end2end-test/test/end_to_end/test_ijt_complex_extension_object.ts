// https://reference.opcfoundation.org/Tightening/DataTypes/ResultDataType/
import "should";
import {
    OPCUAServer,
    nodesets,
    DataType,
    Variant,
    standardUnits,
    ClientSession,
    randomGuid,
    OPCUAClient,
    AttributeIds,
    LocalizedText,
    coerceLocalizedText,
    VariantOptions,
    make_debugLog
} from "node-opcua";

import {
    DTResult,
    UDTResult
} from "node-opcua-nodeset-machinery-result";


import {
    DTJoiningResultMeta,
    DTJoiningResult,
    UDTJoiningResultMeta,
    UDTJoiningResult
} from "node-opcua-nodeset-ijt-base";

const debugLog = make_debugLog("TEST");

interface JoiningResultMetaOptions extends Partial<DTJoiningResultMeta> { }
interface JoiningResultOptions extends Partial<DTJoiningResult> { }
interface ResultOptions extends Partial<DTResult> { }

const nodeId = "s=Result";

const port = 2512;

async function buildServer() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.amb,
            nodesets.machinery,
            nodesets.machineryResult,
            nodesets.ijtBase,
            nodesets.tightening
        ]
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;

    debugLog(addressSpace.getNamespaceArray().map((a) => a.namespaceUri).join("\n"));

    const nsTightening = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/Tightening/");
    if (nsTightening === -1) throw new Error("cannot find Thightening namespace");

    const nsIJTBase = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/Base/");
    if (nsIJTBase === -1) throw new Error("cannot find IJTBase namespace");

    const nsMachineryResult = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/Result/");
    if (nsMachineryResult === -1) throw new Error("cannot find MachineryResult namespace");

    const ResultDataType = addressSpace.findDataType("ResultDataType", nsMachineryResult);
    if (!ResultDataType) throw new Error("cannot find ResultDataType");

    const JoiningResultMetaDataType = addressSpace.findDataType("JoiningResultMetaDataType", nsIJTBase);
    if (!JoiningResultMetaDataType) throw new Error("cannot find JoiningResultMetaDataType");

    const JoiningResultDataType = addressSpace.findDataType("JoiningResultDataType", nsIJTBase);
    if (!JoiningResultDataType) throw new Error("cannot find JoiningResultDataType");

    const joiningResultMetaDataInfo: JoiningResultMetaOptions = {

        assemblyType: 1,
        associatedEntities: [
            {
                entityId: "AAA",
                entityType: 1,
                description: "aa",
                entityOriginId: "AAA",
                isExternal: false,
                name: "AAA",
            }
        ],
        stepId: randomGuid(),
        classification: 1,
        creationTime: new Date(),
        description: new LocalizedText({ text: "AAA" }),
        resultEvaluation: 1,
        sequenceNumber: [1, 2, 3],
    };
    const example2: JoiningResultOptions = {
        overallResultValues: [
            {
                measuredValue: 1,
                parameterIdList: ["AAA"],
                name: "AAA",
                lowLimit: 10,
                highLimit: 1000,
                resultEvaluation: 1,
                valueId: randomGuid(),
                valueTag: 1,
                engineeringUnits: standardUnits.centimetre,
                physicalQuantity: 1,
                resultStep: "1",
                sensorId: randomGuid(),
                targetValue: 1,
                tracePointIndex: 1,
                tracePointTimeOffset: 0,
                violationConsequence: 1,
                violationType: 1
            }
        ],
        errors: [
            {
                errorType: 1,
                errorId: "1",
                errorMessage: coerceLocalizedText("message")!,

            },
        ],
        failureReason: 1,
        failingStepResultId: randomGuid(),
        stepResults: [
            {
                stepResultId: randomGuid(),
                stepResultValues: [
                    {
                        measuredValue: 1,
                        parameterIdList: ["AAA"],
                        name: "AAA",
                        lowLimit: 10,
                        highLimit: 1000,
                        resultEvaluation: 1,
                        valueId: randomGuid(),
                        valueTag: 1,
                        engineeringUnits: standardUnits.centimetre,
                        physicalQuantity: 1,
                        resultStep: "1",
                        sensorId: randomGuid(),
                        targetValue: 1,
                        tracePointIndex: 1,
                        tracePointTimeOffset: 0,
                        violationConsequence: 1,
                        violationType: 1
                    }
                ]
            }
        ],
    };
    const joiningResultMetaData = addressSpace.constructExtensionObject(JoiningResultMetaDataType, joiningResultMetaDataInfo) as UDTJoiningResultMeta;

    const resultContent1 = addressSpace.constructExtensionObject(JoiningResultDataType, example2) as UDTJoiningResult;


    const result = addressSpace.constructExtensionObject(ResultDataType, <ResultOptions>{
        resultMetaData: joiningResultMetaData,
        resultContent: [
            new Variant({ dataType: DataType.ExtensionObject, value: resultContent1 })
        ]
    }) as UDTResult;

    const namespace = addressSpace.getOwnNamespace();
    const variable = namespace.addVariable({
        browseName: "Test",
        nodeId,
        dataType: ResultDataType,
        componentOf: addressSpace.rootFolder.objects.server
    });
    variable.setValueFromSource({
        dataType: DataType.ExtensionObject,
        value: result
    });

    debugLog(result.toString());
    debugLog("--------------------------");
    debugLog(result.toString());

    await server.start();

    return server;
}

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
describe("test complex dataStructure in thightening", function (this: Mocha.Suite) {

    this.timeout(Math.max(this.timeout(), 60000));

    let server: OPCUAServer;
    before(async () => {
        server = await buildServer();
    });
    after(async () => {
        await server.shutdown();
    });
    it("should read a complex data structure", async () => {

        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const result: UDTResult = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const d = await session.read({
                nodeId: "ns=1;" + nodeId,
                attributeId: AttributeIds.Value
            });
            return d.value.value as UDTResult;
        });

        debugLog(result.toString());

        const resultContent = result.resultContent[0] as VariantOptions;

        debugLog(resultContent.toString());
        resultContent.dataType!.should.eql(DataType.ExtensionObject);
        resultContent.value!.should.be.instanceOf(Object);
        resultContent.value!.constructor.schema.name.should.eql("JoiningResultDataType");

    });
});

