/**
 * @module node-opcua-address-space
 */
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { INamespace, UAObject, ISessionContext } from "node-opcua-address-space-base";
import { UAFolder } from "node-opcua-nodeset-ua";
import { CallMethodResultOptions } from "node-opcua-types";

export function add_eventGeneratorObject(namespace: INamespace, parentFolder: UAFolder | string): void {
    const myEvtType = namespace.addEventType({
        browseName: "MyEventType",
        subtypeOf: "BaseEventType" // should be implicit
    });

    const myObject = namespace.addObject({
        browseName: "EventGeneratorObject",
        eventNotifier: 1,
        organizedBy: parentFolder
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

    method.bindMethod((inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) => {
        // xx console.log("In Event Generator Method");
        // xx console.log(this.toString());
        // xx console.log(context.object.toString());

        // xx console.log("inputArguments ", inputArguments[0].toString());

        const message = inputArguments[0].value || "Hello from Event Generator Object";
        const severity = inputArguments[1].value || 0;

        const myEventType = namespace.addressSpace.findEventType("MyEventType", namespace.index)!;
        (context.object as UAObject).raiseEvent(myEventType, {
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
