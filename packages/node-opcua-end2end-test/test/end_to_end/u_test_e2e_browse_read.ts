import "should";
import {
    BrowseDirection,
    VariableIds,
    AttributeIds,
    StatusCodes,
    DataType,
    DataValue,
    ReferenceTypeIds,
    makeNodeId,
    VariantArrayType,
    ReadRequest,
    TimestampsToReturn,
    OPCUAClient,
    coerceNodeId
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const fail_fast_connectivity_strategy = {
    maxRetry: 1,
    initialDelay: 10,
    maxDelay: 20,
    randomisationFactor: 0
};

// simple helper to promisify node-style callbacks
function call<T>(fn: Function, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
        fn(...args, (err: any, result: T) => (err ? reject(err) : resolve(result)));
    });
}

async function expectErrorMessage(regex: RegExp, fn: () => Promise<any>) {
    let failed = false;
    try {
        await fn();
    } catch (err: any) {
        failed = true;
        err.message.should.match(regex);
    }
    if (!failed) {
        throw new Error("Expected error matching " + regex);
    }
}

export function t(test: TestHarness) {
    describe("Browse-Read-Write Services", () => {
        let session: any; // ClientSession
        let client: any;
        let endpointUrl: string;
        let temperatureVariableId: any;

        const options = { connectionStrategy: fail_fast_connectivity_strategy };

        beforeEach(async () => {
            endpointUrl = test.endpointUrl;
            temperatureVariableId = test.server.temperatureVariableId;
            client = OPCUAClient.create(options);
            await client.connect(endpointUrl);
            session = await client.createSession();
        });

        afterEach(async () => {
            if (session) {
                await session.close();
            }
            if (client) {
                await client.disconnect();
            }
        });

        it("T8-1 - should browse RootFolder", async () => {
            const browseResult: any = await call(session.browse.bind(session), "RootFolder");
            browseResult.schema.name.should.equal("BrowseResult");
            browseResult.statusCode.should.eql(StatusCodes.Good);
            browseResult.references.length.should.eql(3);
            browseResult.references[0].browseName.toString().should.eql("Objects");
            browseResult.references[1].browseName.toString().should.eql("Types");
            browseResult.references[2].browseName.toString().should.eql("Views");
        });

        it("T8-2 - browse should return BadReferenceTypeIdInvalid if referenceTypeId is invalid", async () => {
            const nodeToBrowse = {
                nodeId: "ObjectsFolder",
                referenceTypeId: "ns=3;i=3500", // invalid
                browseDirection: BrowseDirection.Forward
            };
            const browseResult: any = await call(session.browse.bind(session), nodeToBrowse);
            browseResult.schema.name.should.equal("BrowseResult");
            browseResult.statusCode.should.eql(StatusCodes.BadReferenceTypeIdInvalid);
        });

        it("T8-3 - should read a Variable", async () => {
            const dataValues: any[] = await call(session.readVariableValue.bind(session), ["RootFolder"]);
            dataValues.length.should.equal(1);
            dataValues[0].schema.name.should.equal("DataValue");
        });

        it("T8-11 - ReadRequest empty nodesToRead -> BadNothingToDo", async () => {
            const request = new ReadRequest({ nodesToRead: [], maxAge: 0, timestampsToReturn: TimestampsToReturn.Both });
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await call(session.performMessageTransaction.bind(session), request);
            });
        });

        it("T8-12 - ReadRequest invalid timestampsToReturn -> BadTimestampsToReturnInvalid", async () => {
            const request = new ReadRequest({ nodesToRead: [{ nodeId: coerceNodeId("ns=0;i=2456") }], maxAge: 0, timestampsToReturn: TimestampsToReturn.Invalid });
            await expectErrorMessage(/BadTimestampsToReturnInvalid/, async () => {
                await call(session.performMessageTransaction.bind(session), request);
            });
        });

        it("T8-13 - readAllAttributes single element", async () => {
            const data: any = await call(session.readAllAttributes.bind(session), "RootFolder");
            data.nodeId.toString().should.eql("ns=0;i=84");
            data.statusCode.should.eql(StatusCodes.Good);
            data.browseName.toString().should.eql("Root");
        });

        it("T8-13b - readAllAttributes two elements", async () => {
            const data: any[] = await call(session.readAllAttributes.bind(session), ["RootFolder", "ObjectsFolder"]);
            data.length.should.eql(2);
            data[0].browseName.toString().should.eql("Root");
            data[1].browseName.toString().should.eql("Objects");
        });

        it("T8-14a - readVariableValue single unknown node => BadNodeIdUnknown", async () => {
            const dataValue: any = await call(session.readVariableValue.bind(session), "ns=1;s=this_node_id_does_not_exist");
            dataValue.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
        });

        it("T8-14b - readVariableValue array unknown node => BadNodeIdUnknown", async () => {
            const dataValues: any[] = await call(session.readVariableValue.bind(session), ["ns=1;s=this_node_id_does_not_exist"]);
            dataValues[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
        });

        it("T8-15 - read empty node array -> BadNothingToDo (serviceResult)", async () => {
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await call(session.read.bind(session), []);
            });
        });

        it("T8-15b - ReadRequest empty nodesToRead -> BadNothingToDo", async () => {
            const readRequest = new ReadRequest({ maxAge: 0, timestampsToReturn: TimestampsToReturn.Both, nodesToRead: [] });
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await call(session.performMessageTransaction.bind(session), readRequest);
            });
        });

        it("T8-15c - ReadRequest null nodesToRead -> BadNothingToDo", async () => {
            const readRequest = new ReadRequest({ maxAge: 0, timestampsToReturn: TimestampsToReturn.Both, nodesToRead: null as any });
            (readRequest as any).nodesToRead = null; // ensure
            await expectErrorMessage(/BadNothingToDo/, async () => {
                await call(session.performMessageTransaction.bind(session), readRequest);
            });
        });

        it("T8-16 - negative maxAge -> BadMaxAgeInvalid", async () => {
            await expectErrorMessage(/BadMaxAgeInvalid/, async () => {
                await call(session.read.bind(session), { nodeId: "RootFolder", attributeId: 13 }, -20000);
            });
        });

        it("T8-17 - readVariableValue TemperatureTarget", async () => {
            const dataValues: any[] = await call(session.readVariableValue.bind(session), [temperatureVariableId.nodeId]);
            dataValues.length.should.equal(1);
            dataValues[0].schema.name.should.equal("DataValue");
            dataValues[0].value.schema.name.should.equal("Variant");
        });

        it("T8-20 - writeSingleNode TemperatureTarget", async () => {
            const statusCode: any = await call(session.write.bind(session), {
                nodeId: temperatureVariableId.nodeId,
                attributeId: AttributeIds.Value,
                value: { value: { dataType: DataType.Double, value: 37.5 } }
            });
            statusCode.should.eql(StatusCodes.Good);
        });

        it("T9-1 - Server object exposed in Objects folder", async () => {
            const Organizes = makeNodeId(ReferenceTypeIds.Organizes);
            const nodesToBrowse = [{ nodeId: "ObjectsFolder", referenceTypeId: Organizes, browseDirection: BrowseDirection.Forward, resultMask: 0x3f }];
            const browseResults: any[] = await call(session.browse.bind(session), nodesToBrowse);
            browseResults.length.should.equal(1);
            browseResults[0].schema.name.should.equal("BrowseResult");
            const foundNode = browseResults[0].references.filter((r: any) => r.browseName.name === "Server");
            foundNode.length.should.equal(1);
            foundNode[0].browseName.name.should.equal("Server");
            foundNode[0].nodeId.toString().should.equal("ns=0;i=2253");
        });

        it("T9-2 - Server_NamespaceArray variable", async () => {
            const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray);
            const dataValue: any = await call(session.readVariableValue.bind(session), server_NamespaceArray_Id);
            dataValue.should.be.instanceOf(DataValue);
            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.dataType.should.eql(DataType.String);
            dataValue.value.arrayType.should.eql(VariantArrayType.Array);
            dataValue.value.value[0].should.eql("http://opcfoundation.org/UA/");
        });

        it("T9-3 - ServerStatus as ExtensionObject", async () => {
            const server_ServerStatus_Id = makeNodeId(VariableIds.Server_ServerStatus);
            const dataValue: any = await call(session.readVariableValue.bind(session), server_ServerStatus_Id);
            dataValue.should.be.instanceOf(DataValue);
            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.dataType.should.eql(DataType.ExtensionObject);
        });
    });
}
