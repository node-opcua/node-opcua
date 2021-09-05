import {
    BaseNode,
    UADataType,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReference,
    UAReferenceType,
    UAVariable,
    UAVariableType,
    ModellingRuleType,
} from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";

import { displayNodeElement } from "./displayNodeElement";

type UAType = UAObjectType | UAVariableType | UAReferenceType | UADataType;

export type UAConcrete = UAVariable | UAObject | UAMethod;

// find the reference that links node1 to node2
function findReferenceToNode(node1: BaseNode, node2: BaseNode): UAReference {
    const references = node1.allReferences();
    const r = references.filter((reference: UAReference) => {
        return reference.nodeId.toString() === node2.nodeId.toString();
    });
    const ref = r ? r[0] : null;
    /* istanbul ignore next */
    if (!ref) {
        // may be from subtype
        if (
            node1.nodeClass === NodeClass.ObjectType ||
            node1.nodeClass === NodeClass.ReferenceType ||
            node1.nodeClass === NodeClass.VariableType
        ) {
            const uaType = node1 as UAType;
            if (uaType.subtypeOfObj) {
                return findReferenceToNode(uaType.subtypeOfObj, node2);
            }
        }

        throw new Error("Internal Error cannot find ref from node " + node1.nodeId.toString() + " " + node2.nodeId.toString());
    }
    return ref;
}

export function getChildInTypeOrBaseType(
    node: UAObjectType | UAVariableType,
    propertyName: string,
    namespaceIndex: number
): { propInSuperType: UAConcrete; reference: UAReference } {
    const addressSpace = node.addressSpace;

    const subtypeOf = node.subtypeOfObj!;
    /* istanbul ignore next */
    if (!subtypeOf) {
        throw new Error("Expecting a super type");
    }

    const browseResult = addressSpace.browsePath(makeBrowsePath(subtypeOf.nodeId, `.${namespaceIndex}:${propertyName}`));
    const propNodeId = !browseResult.targets || !browseResult.targets[0] ? null : browseResult.targets[0].targetId!;

    /* istanbul ignore next */
    if (!propNodeId) {
        displayNodeElement(subtypeOf);
        throw new Error("property " + propertyName + " do not exists on " + subtypeOf.browseName.toString() + " or any superType");
    }

    const propInSuperType = addressSpace.findNode(propNodeId)! as UAVariable | UAMethod | UAObject;

    /* istanbul ignore next */
    if (!propInSuperType) {
        throw new Error("cannot find " + propNodeId.toString());
    }
    // replicate property
    const reference = findReferenceToNode(subtypeOf, propInSuperType);

    /* istanbul ignore next */
    if (!reference) {
        throw new Error("cannot find reference");
    }
    return { propInSuperType, reference };
}

export function promoteToMandatory(node: UAObjectType | UAVariableType, propertyName: string, namespaceIndex: number): UAConcrete {
    // get base node

    const { propInSuperType, reference } = getChildInTypeOrBaseType(node, propertyName, namespaceIndex);

    // check mandatory
    /* istanbul ignore next */
    if (propInSuperType.modellingRule === "Mandatory") {
        // tslint:disable-next-line: no-console
        console.log("Warning property " + propertyName + " is already Mandatory in super type");
        return propInSuperType;
    }

    const newRef = {
        isForward: false,
        nodeId: node.nodeId,
        referenceType: reference.referenceType
    };

    const newProp = (propInSuperType as UAConcrete).clone({
        namespace: node.namespace,
        modellingRule: "Mandatory",
        references: [newRef]
    });
    return newProp;
}

export function promoteChild(
    node: UAObjectType | UAVariableType,
    propertyName: string,
    namespaceIndex: number,
    modellingRule: ModellingRuleType
): UAConcrete {
    const { propInSuperType, reference } = getChildInTypeOrBaseType(node, propertyName, namespaceIndex);

    if (!modellingRule) {
        modellingRule = propInSuperType.modellingRule || null;
    }

    const newRef: UAReference = {
        isForward: false,
        nodeId: node.nodeId,
        referenceType: reference.referenceType
    };

    const newProp = (propInSuperType as UAConcrete).clone({
        namespace: node.namespace,
        modellingRule,
        references: [{...newRef}]
    });
    return newProp;
}
