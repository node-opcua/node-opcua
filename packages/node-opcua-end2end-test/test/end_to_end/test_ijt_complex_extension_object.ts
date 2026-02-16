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
    make_debugLog,
    getExtraDataTypeManager,
    DataTypeExtractStrategy,
    readNamespaceArray,
    resolveNodeId,
    ExtensionObject,
    IAddressSpace,
    StatusCodes,
    DataValue,
    AddressSpace,
    generateAddressSpace,
    UAVariable,
    BinaryStream,
    promoteOpaqueStructure,
    PseudoSession,
    coerceUInt64,
    coerceInt64
} from "node-opcua";

import {
    DTResult,
    UDTResult,
    UDTResultMeta
} from "node-opcua-nodeset-machinery-result";


import {
    DTJoiningResultMeta,
    DTJoiningResult,
    UDTJoiningResultMeta,
    UDTJoiningResult
} from "node-opcua-nodeset-ijt-base";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");

interface JoiningResultMetaOptions extends Partial<DTJoiningResultMeta> { }
interface JoiningResultOptions extends Partial<DTJoiningResult> { }
interface ResultOptions extends Partial<DTResult> { }

const nodeId = "s=Result";

const port = 2512;


async function buildAddressSpace(addressSpace: IAddressSpace) {

    debugLog(addressSpace.getNamespaceArray().map((a) => a.namespaceUri).join("\n"));

    const nsTightening = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/Tightening/");
    if (nsTightening === -1) throw new Error("cannot find Tightening namespace");

    const nsIJTBase = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/Base/");
    if (nsIJTBase === -1) throw new Error("cannot find IJTBase namespace");

    const nsMachineryResult = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/Result/");
    if (nsMachineryResult === -1) throw new Error("cannot find MachineryResult namespace");

    const ResultDataType = addressSpace.findDataType("ResultDataType", nsMachineryResult);
    if (!ResultDataType) throw new Error("cannot find ResultDataType");

    const ResultMetaDataType = addressSpace.findDataType("ResultMetaDataType", nsMachineryResult);
    if (!ResultMetaDataType) throw new Error("cannot find ResultMetaDataType");

    const JoiningResultMetaDataType = addressSpace.findDataType("JoiningResultMetaDataType", nsIJTBase);
    if (!JoiningResultMetaDataType) throw new Error("cannot find JoiningResultMetaDataType");

    const JoiningResultDataType = addressSpace.findDataType("JoiningResultDataType", nsIJTBase);
    if (!JoiningResultDataType) throw new Error("cannot find JoiningResultDataType");


    const EntityDataType = addressSpace.findDataType("EntityDataType", nsIJTBase);
    if (!EntityDataType) throw new Error("cannot find EntityDataType");


    const joiningResultMetaDataInfo: JoiningResultMetaOptions = {

        resultId: 'DB751F14-76CE-D949-A557-384FCC8126D4',
        hasTransferableDataOnFile: undefined,
        isPartial: false,
        isSimulated: true,
        resultState: 1,
        stepId: undefined,
        partId: undefined,
        externalRecipeId: undefined,
        internalRecipeId: undefined,
        productId: undefined,
        externalConfigurationId: undefined,
        internalConfigurationId: undefined,
        jobId: undefined,
        creationTime: new Date(),
        processingTimes: {
            endTime: new Date(),
            startTime: new Date(new Date().getTime() - 1000000),
            acquisitionDuration: 1000000,
            processingDuration: 100,
        },
        resultUri: undefined,
        resultEvaluation: 1,
        assemblyType: 1,
        associatedEntities: [
            {
                name: 'VIN',
                description: 'Vehicle Identification Number',
                entityId: '4Y1SL65848Z411439',
                entityOriginId: '',
                isExternal: true,
                entityType: 20

            },
            {
                name: 'ProgramId',
                description: 'Program_4_Steps',
                entityId: '0952E9B4-05F6-4B43-B66C-B8027FBE966A',
                entityOriginId: 'DCCA6C76-3926-455B-959B-EA3082FCD091',
                isExternal: false,
                entityType: 27
            },
            {
                entityId: "AAA",
                entityType: 1,
                description: "aa",
                entityOriginId: "AAA",
                isExternal: false,
                name: "AAA",
            }
        ],
        classification: 1,
        description: new LocalizedText({ text: "AAA" }),
        sequenceNumber: coerceInt64(32),
        joiningTechnology: coerceLocalizedText({ locale: 'en', text: 'Tightening' })!,
        operationMode: 1,
        name: "AAA",
        resultEvaluationCode: coerceInt64(12),
        resultEvaluationDetails: new LocalizedText({ text: "AAA" }),
        resultCounters: [{
            name: "1",
            counterValue: 1,
            counterType: 1
        }],
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
    debugLog("--------------------------");
    debugLog(result.toString());

    const resultMeta = namespace.addVariable({
        browseName: "TestMeta",
        nodeId: "ns=1;s=TestMeta",
        dataType: ResultMetaDataType,
        componentOf: addressSpace.rootFolder.objects.server
    });
    resultMeta.setValueFromSource({
        dataType: DataType.ExtensionObject,
        value: joiningResultMetaData
    });
    debugLog("--------------------------");
    debugLog(joiningResultMetaData.toString());




}


describe("X-test complex dataStructure in tightening - server side", () => {

    let addressSpace: AddressSpace;
    before(async () => {

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.amb,
            nodesets.machinery,
            nodesets.machineryResult,
            nodesets.ijtBase,
            nodesets.tightening
        ]);
        await buildAddressSpace(addressSpace);

    });
    after(() => {
        addressSpace.dispose();
    });


    async function testDataValueEncodingDecoding(addressSpace: IAddressSpace, dataValue: DataValue) {
        console.log(dataValue.toString());

        const binaryStream = new BinaryStream(dataValue.binaryStoreSize());
        dataValue.encode(binaryStream);

        binaryStream.rewind();
        const reloaded = new DataValue();
        reloaded.decode(binaryStream);

        const session = new PseudoSession(addressSpace);
        await promoteOpaqueStructure(session, [reloaded]);

        console.log(reloaded.toString());

        dataValue.toString().should.eql(reloaded.toString());
    }
    it("X-TestMeta: should read a complex data structure", async () => {

        const node = addressSpace.findNode("ns=1;s=TestMeta") as UAVariable;
        node.should.not.eql(null);
        const dataValue: DataValue = node!.readValue();
        await testDataValueEncodingDecoding(addressSpace, dataValue);

    });
    it("X-Result: should read a complex data structure", async () => {

        const node = addressSpace.findNode("ns=1;s=Result") as UAVariable;
        node.should.not.eql(null);
        const dataValue: DataValue = node!.readValue();
        await testDataValueEncodingDecoding(addressSpace, dataValue);

    });
});
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

    await buildAddressSpace(addressSpace);
    await server.start();

    return server;
}

describe("test complex dataStructure in tightening", function (this: Mocha.Suite) {

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

    it("should encode and decode derived Union DataType", async () => {
        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({
            endpointMustExist: false
        });

        const resultMeta: UDTResultMeta = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {


            const namespaceArray = await readNamespaceArray(session);
            const ijt = namespaceArray.indexOf("http://opcfoundation.org/UA/IJT/Base/");
            if (ijt === -1) {
                throw new Error("Namespace IJT not found");
            }
            const dataTypeManager = await getExtraDataTypeManager(session, DataTypeExtractStrategy.Force104);
            dataTypeManager.hasDataTypeFactory(0).should.eql(true);

            const jointResultMetaDataTypeNodeId = resolveNodeId(`ns=${ijt};i=3020`);

            const extObj = await session.constructExtensionObject(jointResultMetaDataTypeNodeId,
                <DTJoiningResultMeta>{
                    resultId: 'DB751F14-76CE-D949-A557-384FCC8126D5',
                    hasTransferableDataOnFile: false,
                    isPartial: false,
                    isSimulated: true,
                    resultState: 1,
                    stepId: undefined,
                    partId: undefined,
                    externalRecipeId: undefined,
                    internalRecipeId: undefined,
                    productId: undefined,
                    externalConfigurationId: undefined,
                    internalConfigurationId: undefined,
                    jobId: undefined,
                    creationTime: new Date(),
                    processingTimes: {
                        startTime: new Date(),
                        endTime: new Date(),
                        acquisitionDuration: 100,
                        processingDuration: 50
                    },
                    resultUri: undefined,
                    resultEvaluation: 1,
                    resultEvaluationCode: coerceInt64(10),
                    resultEvaluationDetails: new LocalizedText({ locale: 'en', text: 'OK TIGHTENING' }),
                    fileFormat: undefined,
                    joiningTechnology: new LocalizedText({ locale: 'en', text: 'Tightening' }),
                    sequenceNumber: coerceUInt64(20),
                    name: 'Single:Tightening:Result:2',
                    description: new LocalizedText({ locale: 'en', text: 'Single:Tightening:Result:2' }),
                    classification: 1,
                    operationMode: 2,
                    assemblyType: 1,
                    associatedEntities: [
                        {
                            name: 'VIN',
                            description: 'Vehicle Identification Number',
                            entityId: '4Y1SL65848Z411439',
                            entityOriginId: '',
                            isExternal: true,
                            entityType: 20
                        },
                        {
                            name: 'ProgramId',
                            description: 'Program_4_Steps',
                            entityId: '0952E9B4-05F6-4B43-B66C-B8027FBE966A',
                            entityOriginId: 'DCCA6C76-3926-455B-959B-EA3082FCD091',
                            isExternal: false,
                            entityType: 27
                        },
                        {
                            name: 'ProgramId',
                            description: 'Program_4_Steps',
                            entityId: '0952E9B4-05F6-4B43-B66C-B8027FBE966A',
                            entityOriginId: 'DCCA6C76-3926-455B-959B-EA3082FCD091',
                            isExternal: false,
                            entityType: 27

                        },
                    ],
                    interventionType: 0,
                    isGeneratedOffline: false,
                    extendedMetaData: undefined,
                } as any);

            const statusCode = await session.write({
                nodeId: "ns=1;s=TestMeta",
                attributeId: AttributeIds.Value,
                value: new DataValue({
                    value: new Variant({ dataType: DataType.ExtensionObject, value: extObj })
                })
            });
            statusCode.should.eql(StatusCodes.Good);


            const d = await session.read({
                nodeId: "ns=1;s=TestMeta",
                attributeId: AttributeIds.Value
            });
            return d.value.value as UDTResultMeta;
        });

        debugLog(resultMeta.toString());


    })
});
