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
    AttributeIds
} from "node-opcua";

import { DTResult, DTTighteningResult, UDTTighteningResult, UDTResult } from "node-opcua-nodeset-ijt";

interface TighteningResultOptions extends Partial<DTTighteningResult> {}
interface ResultOptions extends Partial<DTResult> {}
const nodeId = "s=Result";

const port = 2512;

async function buildServer() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.machinery, nodesets.tightening]
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;

    console.log(addressSpace.getNamespaceArray().map((a) => a.namespaceUri));

    const nsTightening = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/");
    if (nsTightening === -1) throw new Error("cannot find Thightening namespace");

    const ResultDataType = addressSpace.findDataType("ResultDataType", nsTightening);
    if (!ResultDataType) throw new Error("cannot find ResultDataType");
    const TighteningResultDataType = addressSpace.findDataType("TighteningResultDataType", nsTightening);
    if (!TighteningResultDataType) throw new Error("cannot find ResultDataType");

    const p: TighteningResultOptions = {
        failureReason: 1,
        trace: {
            traceId: randomGuid(),
            resultId: randomGuid(),
            stepTraces: [
                {
                    numberOfTracePoints: 1,
                    samplingInterval: 10,
                    startTimeOffset: 0,
                    stepResultId: randomGuid(),
                    stepTraceContent: [
                        {
                            values: [1, 2, 3],
                            sensorId: randomGuid(),
                            description: "",
                            engineeringUnits: standardUnits.ampere,
                            name: "1",
                            physicalQuantity: 1
                        }
                    ],
                    stepTraceId: randomGuid()
                }
            ]
        },
        overallResultValues: [
            {
                value: 1,
                name: "AAA",
                lowLimit: 10,
                highLimit: 1000,
                resultEvaluation: 1,
                valueId: randomGuid(),
                valueTag: 1,
                engineeringUnits: standardUnits.centimetre,
                physicalQuantity: 1,
                reporterId: randomGuid(),
                resultStep: "1",
                sensorId: randomGuid(),
                targetValue: 1,
                tracePointIndex: 1,
                tracePointTimeOffset: 0,
                violationConsequence: 1,
                violationType: 1
            }
        ]
    };
    const content = addressSpace.constructExtensionObject(TighteningResultDataType, p) as UDTTighteningResult;

    const result = addressSpace.constructExtensionObject(ResultDataType, <ResultOptions>{
        creationTime: new Date(),
        resultContent: new Variant({
            dataType: DataType.ExtensionObject,
            value: content
        })
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

        const resultContent = (result.resultContent as unknown as Variant).value! as UDTTighteningResult;
        console.log(resultContent.toString());
        resultContent.failureReason!.should.eql(1);
        resultContent.overallResultValues!.length.should.eql(1);
        resultContent.overallResultValues![0].value!.should.eql(1);
        resultContent.overallResultValues![0].name!.should.eql("AAA");
        resultContent.trace!.stepTraces.length.should.eql(1);
    });
});
