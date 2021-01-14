import { ClientSession, DataType, OPCUAClient, OPCUAServer, StatusCodes } from "node-opcua";
import "should";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("list status codes for input arguments", () => {
    const port = 2002;
    const server = new OPCUAServer({
        port
    });

    const client = OPCUAClient.create({
        endpoint_must_exist: false
    });
    let clientSession: ClientSession;

    before(async () => {
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(addressSpace.rootFolder.objects, {
            browseName: "e2e",
            nodeId: "ns=1;s=e2e"
        });
        namespace
            .addMethod(folder, {
                browseName: "RingDoor",
                nodeId: "ns=1;s=RingDoor",
                inputArguments: [{ dataType: DataType.UInt16, name: "times" }]
            })
            .bindMethod((inputArguments, context, callback) => {
                if (inputArguments[0].value === 0) {
                    return callback(null, {
                        statusCode: StatusCodes.BadInvalidArgument
                    });
                }
                if (inputArguments[0].value > 3) {
                    return callback(null, {
                        statusCode: StatusCodes.BadInvalidArgument,
                        inputArgumentResults: [StatusCodes.BadOutOfRange]
                    });
                }
                callback(null, { statusCode: StatusCodes.Good, inputArgumentResults: [StatusCodes.Good] });
            });
        await server.start();
        await client.connect(`opc.tcp://localhost:${port}/UA/NodeOPCUA`);
        clientSession = await client.createSession();
    });

    after(async () => {
        await clientSession.close();
        await client.disconnect();
        await server.shutdown();
    });

    it("should return no error", async () => {
        const result = await clientSession.call({
            objectId: "ns=1;s=e2e",
            methodId: "ns=1;s=RingDoor",
            inputArguments: [{ dataType: DataType.UInt16, value: 1 }]
        });
        result.statusCode.should.eql(StatusCodes.Good);
        result.inputArgumentResults![0].should.eql(StatusCodes.Good);
    });

    it("should return lib generated error", async () => {
        const result = await clientSession.call({
            objectId: "ns=1;s=e2e",
            methodId: "ns=1;s=RingDoor",
            inputArguments: [{ dataType: DataType.UInt32, value: 1 }]
        });
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.inputArgumentResults![0].should.eql(StatusCodes.BadTypeMismatch);
    });

    it("should return custom error", async () => {
        const result = await clientSession.call({
            objectId: "ns=1;s=e2e",
            methodId: "ns=1;s=RingDoor",
            inputArguments: [{ dataType: DataType.UInt16, value: 4 }]
        });
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.inputArgumentResults![0].should.eql(StatusCodes.BadOutOfRange);
    });

    it("should return default status code good if no custom status code is provided for input argument result", async () => {
        const result = await clientSession.call({
            objectId: "ns=1;s=e2e",
            methodId: "ns=1;s=RingDoor",
            inputArguments: [{ dataType: DataType.UInt16, value: 0 }]
        });
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.inputArgumentResults![0].should.eql(StatusCodes.Good);
    });
});
