import type { UAObject, UAObjectType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-types";
import { initialize_properties_and_components } from "../src/_instantiate_helpers";

export function implementInterface(
    uaNode: UAObject | UAObjectType | UAVariable | UAVariableType,
    interfaceType: UAObjectType,
    optionals?: string[],
    isModellingType?: boolean
) {
    optionals = optionals || [];

    const addressSpace = uaNode.addressSpace;
    const topMost = addressSpace.findObjectType("BaseInterfaceType");
    if (!topMost) {
        throw new Error("cannot find BaseInterfaceType");
    }

    isModellingType =
        isModellingType === undefined
            ? uaNode.nodeClass === NodeClass.ObjectType || uaNode.nodeClass === NodeClass.VariableType
            : isModellingType;

    const copyAlsoModellingRules = isModellingType;
    const copyAlsoAllOptionals = isModellingType;
    initialize_properties_and_components(
        uaNode as UAObject | UAVariable,
        topMost,
        interfaceType,
        copyAlsoModellingRules,
        copyAlsoAllOptionals,
        optionals
    );
    uaNode.addReference({
        nodeId: interfaceType,
        referenceType: "HasInterface"
    });
}
