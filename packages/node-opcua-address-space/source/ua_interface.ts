

import { UAObject, UAObjectType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { BrowseDirection } from "node-opcua-data-model";
import { initialize_properties_and_components } from "../src/_instantiate_helpers";

export function implementInterfaceBad(uaNode: UAObject | UAObjectType | UAVariable | UAVariableType, interfaceType: UAObjectType) {

    const addressSpace = uaNode.addressSpace;
    const tmp = interfaceType.instantiate({
        browseName: uaNode.browseName,
        copyAlsoModellingRules: true,
        copyAlsoAllOptionals: true,
        modellingRule: "Mandatory"
    });
    // 
    uaNode.addReference({
        nodeId: interfaceType,
        referenceType: "HasInterface"
    });
    const childrenRef = tmp.findReferencesEx("HasChild", BrowseDirection.Forward);
    // transfer children to uaNode
    for (const childRef of childrenRef) {

        tmp.removeReference({
            nodeId: childRef.nodeId,
            referenceType: childRef.referenceType,
            isForward: childRef.isForward
        });
        uaNode.addReference({
            nodeId: childRef.nodeId,
            referenceType: childRef.referenceType,
            isForward: childRef.isForward
        });
    }
    addressSpace.deleteNode(tmp);
}

export function implementInterface(uaNode: UAObject | UAObjectType | UAVariable | UAVariableType, interfaceType: UAObjectType) {

    const addressSpace = uaNode.addressSpace;
    const topMost = addressSpace.findObjectType("BaseInterfaceType")!;
    initialize_properties_and_components(uaNode as any, topMost, interfaceType, true, true, []);
    uaNode.addReference({
        nodeId: interfaceType,
        referenceType: "HasInterface"
    });

}
