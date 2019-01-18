// tslint:disable:no-console
import {
    AddressSpace,
    BaseNode,
    DataType,
    MonitoredItem,
    MonitoredItemCreateRequest,
    NodeIdLike,
    nodesets,
    OPCUAServer,
    RegisterServerMethod,
    SessionContext,
    StatusCodes,
    UAMethod,
    UAObject,
    Variant
} from "node-opcua";
import { CallMethodResponse, MethodFunctorCallback } from "../node-opcua-address-space/source";

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
                name: "Param1",
            },
            {
                dataType: DataType.String,
                description: { text: "description of second input argument" },
                name: "Param2",
            },
            {
                dataType: DataType.String,
                description: { text: "description of third input argument" },
                name: "Param3",
            }

        ],
        outputArguments: []
    });

    methodI.bindMethod(function(
      this: UAMethod,
      inputArguments: Variant[],
      context: SessionContext,
      callback: MethodFunctorCallback) {

        const callMethodResult = {
            outputArguments: [],
            statusCode: StatusCodes.Good
        };
        callback(null, callMethodResult);
    });

    return myObject;
}

function callMethodFromServer(addressSpace: AddressSpace, nodeId: NodeIdLike) {
    // Find server commands (methods)
    const commands = addressSpace.getOwnNamespace().findNode("ns=1;s=VALMET-OPCUA-Server") as UAObject;
    if (commands) {
        const method = commands.getMethodByName("DoStuff");

        if (!method) {
            throw new Error("Cannot find method on object");
        }
        // Call method with parameters. Note: buffer size 1000 is default effects only on MEM mode
        const param1 = { dataType: DataType.String, value: "foo" };
        const param2 = { dataType: DataType.UInt32, value: 1000 };
        const param3 = { dataType: DataType.String, value: "bar" };

        const context = SessionContext.defaultContext as SessionContext;
        method.execute(
          [param1, param2, param3],
          context,
          (err: Error | null, callMethodResponse: CallMethodResponse) => {

              if (err || !callMethodResponse) {
                  console.log("something went wrong");
              } else {
                  console.log(callMethodResponse.outputArguments);
              }
        });
    }
}

async function main() {

    try {

        const server = new OPCUAServer({
            nodeset_filename: [
                nodesets.standard_nodeset_file
            ]
        });

        await server.initialize();

        // post-initialize
        const addressSpace = server.engine.addressSpace;

        const object = installObjectWithMethod(addressSpace);

        callMethodFromServer(addressSpace, object.nodeId);

        await server.start();
        console.log(" Server started ", server.endpoints[0].endpointDescriptions()[0].endpointUrl);
    } catch (err) {
        console.log(" Error: ", err.message);
        console.log(err.stack);
    }
}

main();
