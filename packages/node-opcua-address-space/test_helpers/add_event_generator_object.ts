/**
 * @module node-opcua-address-space
 */
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { Folder, MethodFunctor, MethodFunctorCallback, Namespace, SessionContext } from "../source";

export function add_eventGeneratorObject(
    namespace: Namespace,
    parentFolder: Folder | string
) {

    const myEvtType = namespace.addEventType({
        browseName: "MyEventType",
        subtypeOf: "BaseEventType" // should be implicit
    });

    const myObject = namespace.addObject({
        browseName: "EventGeneratorObject",
        eventNotifier: 1,
        organizedBy: parentFolder,
    });

    myObject.addReference({
        nodeId: myEvtType,
        referenceType: "AlwaysGeneratesEvent"
    });

    const method = namespace.addMethod(myObject, {
        browseName: "EventGeneratorMethod",
        inputArguments: [
            {
                dataType: DataType.String,
                description: { text: "Event Message" },
                name: "message"
            },
            {
                dataType: DataType.UInt32,
                description: { text: "Event Severity" },
                name: "severity"
            }
        ],
        outputArguments: []
    });

    method.bindMethod((
        inputArguments: Variant[],
        context: SessionContext,
        callback: MethodFunctorCallback) => {

        // xx console.log("In Event Generator Method");
        // xx console.log(this.toString());
        // xx console.log(context.object.toString());

        // xx console.log("inputArguments ", inputArguments[0].toString());

        const message = inputArguments[0].value || "Hello from Event Generator Object";
        const severity = inputArguments[1].value || 0;

        const myEventType = namespace.addressSpace.findEventType("MyEventType", namespace.index);
        context.object.raiseEvent(myEventType, {
            message: {
                dataType: DataType.LocalizedText,
                value: { text: message }
            },
            severity: {
                dataType: DataType.UInt32,
                value: severity
            }

        });
        // console.log(require("util").inspect(context).toString());
        const callMethodResult = {
            outputArguments: [],
            statusCode: StatusCodes.Good
        };
        callback(null, callMethodResult);
    });

}
