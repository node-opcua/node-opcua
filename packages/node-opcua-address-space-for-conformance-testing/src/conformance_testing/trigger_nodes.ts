/**
 * Trigger nodes that raise events on write.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";
import type { NodeIdLike } from "node-opcua-nodeid";
import { makeNodeId } from "node-opcua-nodeid";
import { DataType, Variant } from "node-opcua-variant";

export function addTriggerNodes(namespace: Namespace, parentFolder: UAObject): void {
    const addressSpace = namespace.addressSpace;

    const myEvtType =
        namespace.findObjectType("MyEventType") ||
        namespace.addEventType({
            browseName: "MyEventType",
            subtypeOf: "BaseEventType"
        });

    function _add_trigger_node(parent: UAObject, browseName: string, nodeId: NodeIdLike) {
        const triggerNode = namespace.addVariable({
            browseName,
            nodeId,
            eventSourceOf: parent,
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        let value = 100.0;
        const getFunc = () => new Variant({ dataType: DataType.Double, value });
        const setFunc = (variant: Variant) => {
            value = variant.value;
            const server = addressSpace.rootFolder.objects.server;
            server.raiseEvent(myEvtType, {
                message: { dataType: DataType.LocalizedText, value: { text: "Hello World" } },
                severity: { dataType: DataType.UInt32, value: 32 }
            });
        };

        triggerNode.bindVariable({ get: getFunc, set: setFunc });
    }

    const sampleTriggerNode = namespace.addObject({
        browseName: "SampleTriggerNode",
        eventNotifier: 0x1,
        organizedBy: parentFolder
    });
    _add_trigger_node(sampleTriggerNode, "TriggerNode01", "s=TriggerNode01");
    _add_trigger_node(sampleTriggerNode, "TriggerNode02", "s=TriggerNode02");
}
