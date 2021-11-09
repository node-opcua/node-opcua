// tslint:disable:no-console
import {
    AddressSpace,
    DataType,
    CallMethodResultOptions,
    NodeIdLike,
    nodesets,
    OPCUAServer,
    SessionContext,
    StatusCodes,
    UAMethod,
    UAObject,
    Variant,
    ISessionContext,
    CallbackT
} from "node-opcua";

function installObjectWithMethod(addressSpace: AddressSpace): UAObject {
    const namespace = addressSpace.getOwnNamespace();

    const myObject: UAObject = namespace.addObject({
        browseName: "Object",
        organizedBy: addressSpace.rootFolder.objects
    });

    const methodI = namespace.addMethod(myObject, {
        browseName: "DoStuff",
        nodeId: "s=DoStuff",

        inputArguments: [
            {
                dataType: DataType.String,
                description: { text: "description of first input argument" },
                name: "Param1"
            },
            {
                dataType: DataType.String,
                description: { text: "description of second input argument" },
                name: "Param2"
            },
            {
                dataType: DataType.String,
                description: { text: "description of third input argument" },
                name: "Param3"
            }
        ],
        outputArguments: [
            {
                dataType: DataType.String,
                description: { text: "description of result output" },
                name: "Result"
            }
        ]
    });

    methodI.bindMethod(async function(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext,
    ): Promise<CallMethodResultOptions> {
        const callMethodResult = {
            outputArguments: [
                new Variant({
                    dataType: DataType.String,
                    value: "Hello World"
                })
            ],
            statusCode: StatusCodes.Good
        };
        return callMethodResult;
    });

    return myObject;
}

async function callMethodFromServer(addressSpace: AddressSpace, nodeId: NodeIdLike) {
    // Find server commands (methods)
    const commands = addressSpace.getOwnNamespace().findNode(nodeId) as UAObject;
    if (commands) {
        const method = commands.getMethodByName("DoStuff");

        if (!method) {
            throw new Error("Cannot find method on object");
        }
        // Call method with parameters. Note: buffer size 1000 is default effects only on MEM mode
        const param1 = { dataType: DataType.String, value: "foo" };
        const param2 = { dataType: DataType.UInt32, value: 1000 };
        const param3 = { dataType: DataType.String, value: "bar" };

        const context = SessionContext.defaultContext;

        const callMethodResponse = await method.execute(commands, [param1, param2, param3], context);

        console.log(callMethodResponse.outputArguments![0]!.toString());
    }
}

async function main() {
    try {
        const server = new OPCUAServer({
            nodeset_filename: [nodesets.standard]
        });

        await server.initialize();

        // post-initialize
        const addressSpace = server.engine.addressSpace!;

        const object = installObjectWithMethod(addressSpace);

        console.log("object = ", object.toString());
        await callMethodFromServer(addressSpace, object.nodeId);

        await server.start();
        console.log(" Server started ", server.getEndpointUrl());
    } catch (err) {
        if (err instanceof Error) {
            console.log(" Error: ", err.message);
            console.log(err.stack);
        }
    }
}

main();
