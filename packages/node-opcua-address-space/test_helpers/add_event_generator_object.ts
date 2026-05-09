/**
 * @module node-opcua-address-space
 */

import type { INamespace, ISessionContext, UAObject } from "node-opcua-address-space-base";
import type { UAFolder } from "node-opcua-nodeset-ua";
import { type CallbackT, StatusCodes } from "node-opcua-status-code";
import type { CallMethodResultOptions } from "node-opcua-types";
import { DataType, type Variant } from "node-opcua-variant";

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
        const callMethodResult = {
            outputArguments: [],
            statusCode: StatusCodes.Good
        };
        callback(null, callMethodResult);
    });
}
