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
    coerceLocalizedText
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

interface JoiningResultMetaOptions extends Partial<DTJoiningResultMeta> {}
interface JoiningResultOptions extends Partial<DTJoiningResult> { }
interface ResultOptions extends Partial<DTResult> {}

const nodeId = "s=Result";

const port = 2512;

async function buildServer() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [
            nodesets.standard, 
            nodesets.di, 
            nodesets.amb, 
            nodesets.machinery, 
            nodesets.machineryResult, 
            nodesets.ijtBase,
            nodesets.tightening
        ]
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;

    console.log(addressSpace.getNamespaceArray().map((a) => a.namespaceUri).join("\n"));

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

    const p: JoiningResultMetaOptions = {

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
        description:new LocalizedText({ text: "AAA" }),
        resultEvaluation: 1,
        sequenceNumber: [1,2,3],
   };
   const q : JoiningResultOptions = {
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
                errorId : "1",
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
    const metaContent = addressSpace.constructExtensionObject(JoiningResultMetaDataType, p) as UDTJoiningResultMeta;
    const content = addressSpace.constructExtensionObject(JoiningResultDataType, p) as UDTJoiningResult;

    const result = addressSpace.constructExtensionObject(ResultDataType, <ResultOptions>{
        resultMetaData: metaContent,
        resultContent: [
            new Variant({
                dataType: DataType.ExtensionObject,
                value: content
            })
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

    console.log(result.toString());
    console.log("--------------------------");
    console.log(result.toString());

    await server.start();

    return server;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("test complex dataStructure in thightning", () => {
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

        console.log(result.toString());

        const resultContent = result.resultContent[0].value as UDTJoiningResult;
        
        console.log(resultContent.toString());
    });
});
